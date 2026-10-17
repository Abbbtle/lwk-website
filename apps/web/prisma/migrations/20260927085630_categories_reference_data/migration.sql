-- Course categories are reference data: every environment needs them.
INSERT INTO "categories" ("id", "slug", "name", "headline", "description", "position", "created_at", "updated_at") VALUES
  (gen_random_uuid(), 'kirtan', 'Kirtan', 'Rediscover Kirtan', 'Learn to sing and lead the holy names with harmonium, mridanga and kartals, from first melodies to leading a full kirtan.', 0, now(), now()),
  (gen_random_uuid(), 'prasadam', 'Prasadam', 'Rediscover Prasadam', 'Cook sanctified vegetarian food with devotion, from everyday meals to festival feasts offered to Krishna.', 1, now(), now()),
  (gen_random_uuid(), 'vaisnava-etiquette', 'Vaisnava Etiquette', 'Rediscover Etiquette', 'Understand the mood and manners of devotional life, at home, in the temple and in the association of devotees.', 2, now(), now()),
  (gen_random_uuid(), 'sastra-study', 'Sastra Study', 'Rediscover Sastra', 'Study the Bhagavad-gita, Upanishads and Vedic literature systematically, with guidance on applying their wisdom.', 3, now(), now())
ON CONFLICT ("slug") DO NOTHING;
