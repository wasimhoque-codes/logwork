ALTER TABLE exercise_choices DROP COLUMN setup;

UPDATE session_exercises
SET identity_key = json_remove(identity_key, '$[2]'),
    prescription = json_remove(prescription, '$.setup');

-- Preserve acknowledgements for requests whose queued payload loses the retired field.
UPDATE mutation_receipts SET payload_hash = 'legacy:' || payload_hash;
