-- Early-leavertermijn: "binnen 3 jaar na de datum van deze overeenkomst"
-- (B-PART-OVK art. 6.2); de overeenkomst is van 30-12-2024. Was afgeleid als
-- 3 jaar na verkrijging (02-01-2028).
UPDATE gebeurtenis
SET datum = '2027-12-30',
    omschrijving = 'Einde early-leavertermijn (3 jaar na de participatieovereenkomst van 30-12-2024)'
WHERE spoor = 1 AND omschrijving LIKE 'Einde early-leavertermijn%';
