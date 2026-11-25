// @vitest-environment node
import net from "node:net";
import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SMTP_CONNECTION_TIMEOUT_MS,
  SMTP_DNS_TIMEOUT_MS,
  SMTP_GREETING_TIMEOUT_MS,
  SMTP_SEND_DEADLINE_MS,
  SMTP_SOCKET_CLOSE_TIMEOUT_MS,
  SMTP_SOCKET_TIMEOUT_MS,
  resetMailTransport,
  sendMail,
} from "@/lib/email/mailer";
import { SEND_LEASE_MS } from "@/lib/newsletter/subscribe";

describe("mailer SMTP bounding and abort teardown", () => {
  const saved = {
    host: process.env.ZOHO_SMTP_HOST,
    port: process.env.ZOHO_SMTP_PORT,
    user: process.env.ZOHO_SMTP_USER,
    pass: process.env.ZOHO_SMTP_PASSWORD,
  };

  let activeServer: net.Server | null = null;
  let activeSockets: net.Socket[] = [];

  beforeEach(() => {
    resetMailTransport();
    activeSockets = [];
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    resetMailTransport();
    for (const socket of activeSockets) {
      socket.destroy();
    }
    activeSockets = [];
    if (activeServer) {
      await new Promise<void>((resolve) =>
        activeServer!.close(() => resolve())
      );
      activeServer = null;
    }

    if (saved.host !== undefined) process.env.ZOHO_SMTP_HOST = saved.host;
    else delete process.env.ZOHO_SMTP_HOST;
    if (saved.port !== undefined) process.env.ZOHO_SMTP_PORT = saved.port;
    else delete process.env.ZOHO_SMTP_PORT;
    if (saved.user !== undefined) process.env.ZOHO_SMTP_USER = saved.user;
    else delete process.env.ZOHO_SMTP_USER;
    if (saved.pass !== undefined) process.env.ZOHO_SMTP_PASSWORD = saved.pass;
    else delete process.env.ZOHO_SMTP_PASSWORD;
  });

  async function startBlackholeServer() {
    let socketClosed = false;
    let socketConnected = false;
    let resolveClosed!: () => void;
    const closedPromise = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });

    const server = net.createServer((socket) => {
      socketConnected = true;
      activeSockets.push(socket);
      socket.on("close", () => {
        socketClosed = true;
        resolveClosed();
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    activeServer = server;
    const address = server.address() as net.AddressInfo;

    return {
      port: address.port,
      wasConnected: () => socketConnected,
      wasClosed: () => socketClosed,
      waitForClose: () => closedPromise,
    };
  }

  it("configures explicit SMTP phase timeouts and overall deadline strictly below SEND_LEASE_MS", async () => {
    for (const ms of [
      SMTP_DNS_TIMEOUT_MS,
      SMTP_CONNECTION_TIMEOUT_MS,
      SMTP_GREETING_TIMEOUT_MS,
      SMTP_SOCKET_TIMEOUT_MS,
      SMTP_SOCKET_CLOSE_TIMEOUT_MS,
      SMTP_SEND_DEADLINE_MS,
    ]) {
      expect(typeof ms).toBe("number");
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThan(SEND_LEASE_MS);
    }

    const createSpy = vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: "msg-test" }),
    } as unknown as ReturnType<typeof nodemailer.createTransport>);

    process.env.ZOHO_SMTP_USER = "digest@herbally.app";
    process.env.ZOHO_SMTP_PASSWORD = "app-password";

    const res = await sendMail({
      to: "user@example.com",
      subject: "Test",
      text: "Hello",
      html: "<p>Hello</p>",
    });

    expect(res).toEqual({ sent: true, id: "msg-test" });
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dnsTimeout: SMTP_DNS_TIMEOUT_MS,
        connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
        greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
        socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
        socketCloseTimeout: SMTP_SOCKET_CLOSE_TIMEOUT_MS,
      })
    );
  });

  it("aborts a hung loopback SMTP connection at deadline and tears down the underlying socket", async () => {
    const blackhole = await startBlackholeServer();
    process.env.ZOHO_SMTP_HOST = "127.0.0.1";
    process.env.ZOHO_SMTP_PORT = String(blackhole.port);
    process.env.ZOHO_SMTP_USER = "digest@herbally.app";
    process.env.ZOHO_SMTP_PASSWORD = "app-password";
    resetMailTransport();

    const start = Date.now();
    const res = await sendMail({
      to: "user@example.com",
      subject: "Timeout test",
      text: "Hello",
      html: "<p>Hello</p>",
      timeoutMs: 80,
    });
    const elapsed = Date.now() - start;

    expect(res).toEqual({
      sent: false,
      reason: "error",
      detail: expect.any(String),
    });
    expect(elapsed).toBeLessThan(3_000);
    expect(blackhole.wasConnected()).toBe(true);

    await Promise.race([
      blackhole.waitForClose(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("socket did not close")), 1_500)
      ),
    ]);
    expect(blackhole.wasClosed()).toBe(true);
  });

  it("cancels an in-flight loopback SMTP send when the caller AbortSignal aborts and closes the socket", async () => {
    const blackhole = await startBlackholeServer();
    process.env.ZOHO_SMTP_HOST = "127.0.0.1";
    process.env.ZOHO_SMTP_PORT = String(blackhole.port);
    process.env.ZOHO_SMTP_USER = "digest@herbally.app";
    process.env.ZOHO_SMTP_PASSWORD = "app-password";
    resetMailTransport();

    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("caller aborted")), 60);

    const res = await sendMail({
      to: "user@example.com",
      subject: "Abort test",
      text: "Hello",
      html: "<p>Hello</p>",
      signal: controller.signal,
      timeoutMs: 5_000,
    });

    expect(res).toEqual({
      sent: false,
      reason: "error",
      detail: expect.any(String),
    });
    expect(blackhole.wasConnected()).toBe(true);

    await Promise.race([
      blackhole.waitForClose(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("socket did not close")), 1_500)
      ),
    ]);
    expect(blackhole.wasClosed()).toBe(true);
  });
});
