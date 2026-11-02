-- Review priority queue (SEO brief, Workstream E).
--
-- Produces one row per herb that has at least one curated interaction pair,
-- with the tier it belongs to. Run against the production database; it only
-- reads. `docs/review-priority.md` is generated from this.
--
-- Tier 1  a severe or contraindicated pair, a high-risk drug (anticoagulant,
--         antidepressant, immunosuppressant, aspirin), or one of the eight herbs
--         linked from the homepage.
-- Tier 2  moderate pairs only.
-- Tier 3  mild pairs only.
--
-- Herbs with no pair at all are deliberately absent: there is no interaction to
-- review against, so they belong to a different programme (monograph depth).

with pairs as (
  select
    di.herb_id,
    count(*) as pair_count,
    max(
      case di.severity
        when 'contraindicated' then 4
        when 'severe' then 3
        when 'moderate' then 2
        when 'mild' then 1
        else 0
      end
    ) as worst_severity,
    bool_or(
      lower(coalesce(di.drug_name, '')) ~
        '(warfarin|aspirin|apixaban|rivaroxaban|clopidogrel|antidepress|ssri|sertraline|fluoxetine|citalopram|escitalopram|tacrolimus|cyclosporine|immunosuppress|methotrexate)'
    ) as touches_high_risk_drug,
    array_agg(distinct di.drug_name) filter (where di.severity in ('severe', 'contraindicated')) as severe_drugs
  from drug_interactions di
  group by di.herb_id
)
select
  h.slug,
  h.name,
  h.provenance ->> 'review_status' as review_status,
  p.pair_count,
  case p.worst_severity
    when 4 then 'contraindicated'
    when 3 then 'severe'
    when 2 then 'moderate'
    when 1 then 'mild'
  end as worst_severity,
  p.severe_drugs,
  h.updated_at,
  case
    when p.worst_severity >= 3
      or p.touches_high_risk_drug
      or h.slug in ('turmeric','garlic','ginger','ginkgo-biloba','st-johns-wort','kava','milk-thistle','ashwagandha')
      then 1
    when p.worst_severity = 2 then 2
    else 3
  end as tier
from herbs h
join pairs p on p.herb_id = h.id
where h.is_published = true
order by tier asc, p.worst_severity desc, p.pair_count desc, h.slug asc;
