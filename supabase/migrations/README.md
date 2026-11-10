# Migration numbering

Files are named `NNNNN_description.sql` and applied by hand against the project
(SQL editor or MCP); there is no automated migration runner in this repo. The
number orders a rebuild — it is not a release id.

## The `00066a` exception

`00066a_baseline_herb_source_tables.sql` deliberately sorts after
`00066_newsletter_consent.sql` and before `00067_precompute_herb_page_bundles.sql`.
It retroactively creates `herb_monograph_sources` and `herb_regulatory_evidence`,
which production got out-of-band; 00067's triggers reference both tables, so a
database rebuilt from these files must create them in that gap. Do not renumber it
to 00067 (that slot is taken) and do not fold it into 00066 — a migration that has
been applied must never be edited.

Any future migration that has to land between two existing ones should use the
same single-letter suffix and say why in a comment at the top of the file.
