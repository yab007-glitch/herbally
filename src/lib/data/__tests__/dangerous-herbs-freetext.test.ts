import { describe, expect, it } from "vitest";
import {
  matchCalculatorBlockedInput,
  matchDangerousHerbInput,
} from "../dangerous-herbs";

describe("dangerous-herb & non-dosable free-text matching", () => {
  it("matches typed toxic/lethal herb names and aliases deterministically", () => {
    expect(matchDangerousHerbInput("Aconite")?.slug).toBe("aconite-processed");
    expect(matchDangerousHerbInput("Atropa belladonna")?.slug).toBe(
      "atropa-belladonna-herb"
    );
    expect(matchDangerousHerbInput("belladonna")?.slug).toBe(
      "atropa-belladonna-herb"
    );
    expect(matchDangerousHerbInput("menthe pouliot")?.slug).toBe(
      "lamiaceae-pennyroyal"
    );
    expect(matchDangerousHerbInput("Oleander")?.slug).toBe("nerium-oleander");
    expect(matchDangerousHerbInput("Poison Hemlock")?.slug).toBe(
      "conium-maculatum-herb"
    );
    expect(matchDangerousHerbInput("Kratom")?.slug).toBe("kratom");
    expect(matchDangerousHerbInput("Wintergreen oil")?.slug).toBe(
      "gaulteria-wintergreen"
    );
  });

  it("classifies dangerous vs non-dosable topical/narrow-margin herbs while not blocking ordinary food herbs", () => {
    expect(matchCalculatorBlockedInput("Aconite")?.kind).toBe("dangerous");
    expect(matchCalculatorBlockedInput("Comfrey")?.kind).toBe("non_dosable");
    expect(matchCalculatorBlockedInput("Arnica")?.kind).toBe("non_dosable");
    expect(matchCalculatorBlockedInput("Turmeric")).toBeNull();
    expect(matchCalculatorBlockedInput("Chamomile")).toBeNull();
  });
});
