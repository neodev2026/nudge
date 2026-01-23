-- ============================================
-- Nudge P0 Phase 샘플 데이터 생성 스크립트
-- Learning Product ID: 770c0442-1d0f-4d84-a998-5cef8190a9a3
-- ============================================

-- ============================================
-- 1. learning_content: 동사 14개
-- ============================================

-- Day 1: gehen, sein
INSERT INTO "learning_content" (id, learning_product_id, content_type, content_name, description, display_order, is_active)
VALUES 
  ('a1000001-0001-0001-0001-000000000001', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'gehen', '가다 - 일상 이동 동사', 1, true),
  ('a1000001-0001-0001-0001-000000000002', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'sein', '~이다 - 존재/상태 동사', 2, true),

-- Day 2: kommen, haben
  ('a1000001-0001-0001-0001-000000000003', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'kommen', '오다 - 방향성 동사', 3, true),
  ('a1000001-0001-0001-0001-000000000004', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'haben', '가지다 - 소유 동사', 4, true),

-- Day 3: essen, trinken
  ('a1000001-0001-0001-0001-000000000005', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'essen', '먹다 - 식사 동사', 5, true),
  ('a1000001-0001-0001-0001-000000000006', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'trinken', '마시다 - 음료 동사', 6, true),

-- Day 4: machen, sehen
  ('a1000001-0001-0001-0001-000000000007', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'machen', '하다 - 행동 동사', 7, true),
  ('a1000001-0001-0001-0001-000000000008', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'sehen', '보다 - 지각 동사', 8, true),

-- Day 5: hören, sagen
  ('a1000001-0001-0001-0001-000000000009', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'hören', '듣다 - 청각 동사', 9, true),
  ('a1000001-0001-0001-0001-000000000010', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'sagen', '말하다 - 발화 동사', 10, true),

-- Day 6: fragen, antworten
  ('a1000001-0001-0001-0001-000000000011', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'fragen', '묻다 - 질문 동사', 11, true),
  ('a1000001-0001-0001-0001-000000000012', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'antworten', '답하다 - 응답 동사', 12, true),

-- Day 7: brauchen, bleiben
  ('a1000001-0001-0001-0001-000000000013', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'brauchen', '필요하다 - 요구 동사', 13, true),
  ('a1000001-0001-0001-0001-000000000014', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'bleiben', '머물다 - 지속 동사', 14, true);

-- ============================================
-- 2. learning_content: 대명사 5개
-- ============================================
INSERT INTO "learning_content" (id, learning_product_id, content_type, content_name, description, display_order, is_active)
VALUES 
  ('a1000001-0002-0002-0002-000000000001', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'ich', '나 - 1인칭 단수', 15, true),
  ('a1000001-0002-0002-0002-000000000002', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'du', '너 - 2인칭 단수 친밀', 16, true),
  ('a1000001-0002-0002-0002-000000000003', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'er', '그 - 3인칭 남성 단수', 17, true),
  ('a1000001-0002-0002-0002-000000000004', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'Sie', '당신 - 2인칭 존칭', 18, true),
  ('a1000001-0002-0002-0002-000000000005', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'wir', '우리 - 1인칭 복수', 19, true);

-- ============================================
-- 3. learning_content: 시간/숫자 표현 5개
-- ============================================
INSERT INTO "learning_content" (id, learning_product_id, content_type, content_name, description, display_order, is_active)
VALUES 
  ('a1000001-0003-0003-0003-000000000001', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'heute', '오늘 - 시간 표현', 20, true),
  ('a1000001-0003-0003-0003-000000000002', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'jetzt', '지금 - 시간 표현', 21, true),
  ('a1000001-0003-0003-0003-000000000003', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'oft', '자주 - 빈도 표현', 22, true),
  ('a1000001-0003-0003-0003-000000000004', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'immer', '항상 - 빈도 표현', 23, true),
  ('a1000001-0003-0003-0003-000000000005', '770c0442-1d0f-4d84-a998-5cef8190a9a3', 'word', 'eins', '1 - 숫자', 24, true);

-- ============================================
-- 4. learning_card: 동사 14개 × 3 카드 = 42개
-- ============================================

-- ========== gehen (가다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0001-00000000000a',
  'a1000001-0001-0001-0001-000000000001',
  'meaning_pronunciation',
  '{
    "word": "gehen",
    "meaning": {
      "ko": "가다",
      "en": "to go"
    },
    "tts_text": "gehen",
    "phonetic": "[ˈɡeːən]",
    "conjugation": {
      "ich": "gehe",
      "du": "gehst",
      "er/sie/es": "geht",
      "wir": "gehen",
      "Sie": "gehen"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0001-00000000000b',
  'a1000001-0001-0001-0001-000000000001',
  'image',
  '{
    "word": "gehen",
    "image_url": "https://images.unsplash.com/photo-1544551763-46a013bb70d5",
    "image_source": "unsplash",
    "alt_text": "사람이 걷는 모습",
    "context": "일상적인 이동"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0001-00000000000c',
  'a1000001-0001-0001-0001-000000000001',
  'example_sentence',
  '{
    "word": "gehen",
    "example_sentence": "Ich gehe nach Hause",
    "translation": {
      "ko": "나는 집에 간다",
      "en": "I go home"
    },
    "pattern": "Ich gehe + [장소]",
    "variations": [
      "Ich gehe zur Arbeit (나는 직장에 간다)",
      "Ich gehe einkaufen (나는 쇼핑하러 간다)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== sein (~이다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0002-00000000000a',
  'a1000001-0001-0001-0001-000000000002',
  'meaning_pronunciation',
  '{
    "word": "sein",
    "meaning": {
      "ko": "~이다, 있다",
      "en": "to be"
    },
    "tts_text": "sein",
    "phonetic": "[zaɪn]",
    "conjugation": {
      "ich": "bin",
      "du": "bist",
      "er/sie/es": "ist",
      "wir": "sind",
      "Sie": "sind"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0002-00000000000b',
  'a1000001-0001-0001-0001-000000000002',
  'image',
  '{
    "word": "sein",
    "image_url": "https://images.unsplash.com/photo-1464820453369-31d2c0b651af",
    "image_source": "unsplash",
    "alt_text": "사람이 존재하는 모습",
    "context": "존재와 상태"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0002-00000000000c',
  'a1000001-0001-0001-0001-000000000002',
  'example_sentence',
  '{
    "word": "sein",
    "example_sentence": "Ich bin hier",
    "translation": {
      "ko": "나는 여기 있다",
      "en": "I am here"
    },
    "pattern": "Ich bin + [장소/상태]",
    "variations": [
      "Ich bin müde (나는 피곤하다)",
      "Ich bin Student (나는 학생이다)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== kommen (오다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0003-00000000000a',
  'a1000001-0001-0001-0001-000000000003',
  'meaning_pronunciation',
  '{
    "word": "kommen",
    "meaning": {
      "ko": "오다",
      "en": "to come"
    },
    "tts_text": "kommen",
    "phonetic": "[ˈkɔmən]",
    "conjugation": {
      "ich": "komme",
      "du": "kommst",
      "er/sie/es": "kommt",
      "wir": "kommen",
      "Sie": "kommen"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0003-00000000000b',
  'a1000001-0001-0001-0001-000000000003',
  'image',
  '{
    "word": "kommen",
    "image_url": "https://images.unsplash.com/photo-1507679799987-c73779587ccf",
    "image_source": "unsplash",
    "alt_text": "사람이 다가오는 모습",
    "context": "이동과 도착"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0003-00000000000c',
  'a1000001-0001-0001-0001-000000000003',
  'example_sentence',
  '{
    "word": "kommen",
    "example_sentence": "Ich komme heute",
    "translation": {
      "ko": "나는 오늘 온다",
      "en": "I come today"
    },
    "pattern": "Ich komme + [시간]",
    "variations": [
      "Ich komme bald (나는 곧 온다)",
      "Ich komme aus Korea (나는 한국에서 왔다)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== haben (가지다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0004-00000000000a',
  'a1000001-0001-0001-0001-000000000004',
  'meaning_pronunciation',
  '{
    "word": "haben",
    "meaning": {
      "ko": "가지다",
      "en": "to have"
    },
    "tts_text": "haben",
    "phonetic": "[ˈhaːbən]",
    "conjugation": {
      "ich": "habe",
      "du": "hast",
      "er/sie/es": "hat",
      "wir": "haben",
      "Sie": "haben"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0004-00000000000b',
  'a1000001-0001-0001-0001-000000000004',
  'image',
  '{
    "word": "haben",
    "image_url": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173",
    "image_source": "unsplash",
    "alt_text": "물건을 들고 있는 손",
    "context": "소유와 보유"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0004-00000000000c',
  'a1000001-0001-0001-0001-000000000004',
  'example_sentence',
  '{
    "word": "haben",
    "example_sentence": "Ich habe Zeit",
    "translation": {
      "ko": "나는 시간이 있다",
      "en": "I have time"
    },
    "pattern": "Ich habe + [명사]",
    "variations": [
      "Ich habe Hunger (나는 배고프다)",
      "Ich habe einen Hund (나는 개가 있다)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== essen (먹다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0005-00000000000a',
  'a1000001-0001-0001-0001-000000000005',
  'meaning_pronunciation',
  '{
    "word": "essen",
    "meaning": {
      "ko": "먹다",
      "en": "to eat"
    },
    "tts_text": "essen",
    "phonetic": "[ˈɛsən]",
    "conjugation": {
      "ich": "esse",
      "du": "isst",
      "er/sie/es": "isst",
      "wir": "essen",
      "Sie": "essen"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0005-00000000000b',
  'a1000001-0001-0001-0001-000000000005',
  'image',
  '{
    "word": "essen",
    "image_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
    "image_source": "unsplash",
    "alt_text": "음식을 먹는 모습",
    "context": "식사 행위"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0005-00000000000c',
  'a1000001-0001-0001-0001-000000000005',
  'example_sentence',
  '{
    "word": "essen",
    "example_sentence": "Ich esse Brot",
    "translation": {
      "ko": "나는 빵을 먹는다",
      "en": "I eat bread"
    },
    "pattern": "Ich esse + [음식]",
    "variations": [
      "Ich esse gern Pizza (나는 피자를 좋아한다)",
      "Was isst du? (너는 무엇을 먹니?)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== trinken (마시다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0006-00000000000a',
  'a1000001-0001-0001-0001-000000000006',
  'meaning_pronunciation',
  '{
    "word": "trinken",
    "meaning": {
      "ko": "마시다",
      "en": "to drink"
    },
    "tts_text": "trinken",
    "phonetic": "[ˈtʁɪŋkən]",
    "conjugation": {
      "ich": "trinke",
      "du": "trinkst",
      "er/sie/es": "trinkt",
      "wir": "trinken",
      "Sie": "trinken"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0006-00000000000b',
  'a1000001-0001-0001-0001-000000000006',
  'image',
  '{
    "word": "trinken",
    "image_url": "https://images.unsplash.com/photo-1544145945-f90425340c7e",
    "image_source": "unsplash",
    "alt_text": "물을 마시는 모습",
    "context": "음료 마시기"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0006-00000000000c',
  'a1000001-0001-0001-0001-000000000006',
  'example_sentence',
  '{
    "word": "trinken",
    "example_sentence": "Ich trinke Kaffee",
    "translation": {
      "ko": "나는 커피를 마신다",
      "en": "I drink coffee"
    },
    "pattern": "Ich trinke + [음료]",
    "variations": [
      "Ich trinke Wasser (나는 물을 마신다)",
      "Was trinkst du? (너는 무엇을 마시니?)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== machen (하다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0007-00000000000a',
  'a1000001-0001-0001-0001-000000000007',
  'meaning_pronunciation',
  '{
    "word": "machen",
    "meaning": {
      "ko": "하다, 만들다",
      "en": "to do, to make"
    },
    "tts_text": "machen",
    "phonetic": "[ˈmaxən]",
    "conjugation": {
      "ich": "mache",
      "du": "machst",
      "er/sie/es": "macht",
      "wir": "machen",
      "Sie": "machen"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0007-00000000000b',
  'a1000001-0001-0001-0001-000000000007',
  'image',
  '{
    "word": "machen",
    "image_url": "https://images.unsplash.com/photo-1531403009284-440f080d1e12",
    "image_source": "unsplash",
    "alt_text": "무언가를 만드는 손",
    "context": "행동과 창조"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0007-00000000000c',
  'a1000001-0001-0001-0001-000000000007',
  'example_sentence',
  '{
    "word": "machen",
    "example_sentence": "Was machst du?",
    "translation": {
      "ko": "너는 무엇을 하니?",
      "en": "What do you do?"
    },
    "pattern": "Was machst du? / Ich mache + [행동]",
    "variations": [
      "Ich mache Hausaufgaben (나는 숙제를 한다)",
      "Ich mache Sport (나는 운동을 한다)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== sehen (보다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0008-00000000000a',
  'a1000001-0001-0001-0001-000000000008',
  'meaning_pronunciation',
  '{
    "word": "sehen",
    "meaning": {
      "ko": "보다",
      "en": "to see"
    },
    "tts_text": "sehen",
    "phonetic": "[ˈzeːən]",
    "conjugation": {
      "ich": "sehe",
      "du": "siehst",
      "er/sie/es": "sieht",
      "wir": "sehen",
      "Sie": "sehen"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0008-00000000000b',
  'a1000001-0001-0001-0001-000000000008',
  'image',
  '{
    "word": "sehen",
    "image_url": "https://images.unsplash.com/photo-1576518593783-f85d69a08b33",
    "image_source": "unsplash",
    "alt_text": "눈과 시선",
    "context": "시각과 관찰"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0008-00000000000c',
  'a1000001-0001-0001-0001-000000000008',
  'example_sentence',
  '{
    "word": "sehen",
    "example_sentence": "Ich sehe das",
    "translation": {
      "ko": "나는 그것을 본다",
      "en": "I see that"
    },
    "pattern": "Ich sehe + [대상]",
    "variations": [
      "Ich sehe dich (나는 너를 본다)",
      "Siehst du das Auto? (너는 그 차를 보니?)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== hören (듣다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0009-00000000000a',
  'a1000001-0001-0001-0001-000000000009',
  'meaning_pronunciation',
  '{
    "word": "hören",
    "meaning": {
      "ko": "듣다",
      "en": "to hear"
    },
    "tts_text": "hören",
    "phonetic": "[ˈhøːʁən]",
    "conjugation": {
      "ich": "höre",
      "du": "hörst",
      "er/sie/es": "hört",
      "wir": "hören",
      "Sie": "hören"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0009-00000000000b',
  'a1000001-0001-0001-0001-000000000009',
  'image',
  '{
    "word": "hören",
    "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    "image_source": "unsplash",
    "alt_text": "헤드폰으로 음악 듣기",
    "context": "청각과 경청"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0009-00000000000c',
  'a1000001-0001-0001-0001-000000000009',
  'example_sentence',
  '{
    "word": "hören",
    "example_sentence": "Ich höre Musik",
    "translation": {
      "ko": "나는 음악을 듣는다",
      "en": "I listen to music"
    },
    "pattern": "Ich höre + [대상]",
    "variations": [
      "Ich höre Radio (나는 라디오를 듣는다)",
      "Hörst du mich? (너는 내 말을 듣니?)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== sagen (말하다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0010-00000000000a',
  'a1000001-0001-0001-0001-000000000010',
  'meaning_pronunciation',
  '{
    "word": "sagen",
    "meaning": {
      "ko": "말하다",
      "en": "to say"
    },
    "tts_text": "sagen",
    "phonetic": "[ˈzaːɡən]",
    "conjugation": {
      "ich": "sage",
      "du": "sagst",
      "er/sie/es": "sagt",
      "wir": "sagen",
      "Sie": "sagen"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0010-00000000000b',
  'a1000001-0001-0001-0001-000000000010',
  'image',
  '{
    "word": "sagen",
    "image_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2",
    "image_source": "unsplash",
    "alt_text": "말하는 사람",
    "context": "발화와 표현"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0010-00000000000c',
  'a1000001-0001-0001-0001-000000000010',
  'example_sentence',
  '{
    "word": "sagen",
    "example_sentence": "Was sagen Sie?",
    "translation": {
      "ko": "당신은 무엇을 말합니까?",
      "en": "What do you say?"
    },
    "pattern": "Was sagst du? / Ich sage + [내용]",
    "variations": [
      "Ich sage ja (나는 그렇다고 말한다)",
      "Sag mal! (한번 말해봐!)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== fragen (묻다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0011-00000000000a',
  'a1000001-0001-0001-0001-000000000011',
  'meaning_pronunciation',
  '{
    "word": "fragen",
    "meaning": {
      "ko": "묻다, 질문하다",
      "en": "to ask"
    },
    "tts_text": "fragen",
    "phonetic": "[ˈfʁaːɡən]",
    "conjugation": {
      "ich": "frage",
      "du": "fragst",
      "er/sie/es": "fragt",
      "wir": "fragen",
      "Sie": "fragen"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0011-00000000000b',
  'a1000001-0001-0001-0001-000000000011',
  'image',
  '{
    "word": "fragen",
    "image_url": "https://images.unsplash.com/photo-1516534775068-ba3e7458af70",
    "image_source": "unsplash",
    "alt_text": "질문하는 모습",
    "context": "질문과 대화"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0011-00000000000c',
  'a1000001-0001-0001-0001-000000000011',
  'example_sentence',
  '{
    "word": "fragen",
    "example_sentence": "Ich frage dich",
    "translation": {
      "ko": "나는 너에게 묻는다",
      "en": "I ask you"
    },
    "pattern": "Ich frage + [대상]",
    "variations": [
      "Ich frage den Lehrer (나는 선생님께 묻는다)",
      "Fragst du mich? (너는 나에게 묻니?)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== antworten (답하다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0012-00000000000a',
  'a1000001-0001-0001-0001-000000000012',
  'meaning_pronunciation',
  '{
    "word": "antworten",
    "meaning": {
      "ko": "답하다, 대답하다",
      "en": "to answer"
    },
    "tts_text": "antworten",
    "phonetic": "[ˈantvɔʁtən]",
    "conjugation": {
      "ich": "antworte",
      "du": "antwortest",
      "er/sie/es": "antwortet",
      "wir": "antworten",
      "Sie": "antworten"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0012-00000000000b',
  'a1000001-0001-0001-0001-000000000012',
  'image',
  '{
    "word": "antworten",
    "image_url": "https://images.unsplash.com/photo-1556761175-4b46a572b786",
    "image_source": "unsplash",
    "alt_text": "대답하는 모습",
    "context": "응답과 반응"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0012-00000000000c',
  'a1000001-0001-0001-0001-000000000012',
  'example_sentence',
  '{
    "word": "antworten",
    "example_sentence": "Ich antworte dir",
    "translation": {
      "ko": "나는 너에게 답한다",
      "en": "I answer you"
    },
    "pattern": "Ich antworte + [대상]",
    "variations": [
      "Ich antworte auf die Frage (나는 질문에 답한다)",
      "Antwortest du mir? (너는 나에게 답하니?)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== brauchen (필요하다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0013-00000000000a',
  'a1000001-0001-0001-0001-000000000013',
  'meaning_pronunciation',
  '{
    "word": "brauchen",
    "meaning": {
      "ko": "필요하다",
      "en": "to need"
    },
    "tts_text": "brauchen",
    "phonetic": "[ˈbʁaʊxən]",
    "conjugation": {
      "ich": "brauche",
      "du": "brauchst",
      "er/sie/es": "braucht",
      "wir": "brauchen",
      "Sie": "brauchen"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0013-00000000000b',
  'a1000001-0001-0001-0001-000000000013',
  'image',
  '{
    "word": "brauchen",
    "image_url": "https://images.unsplash.com/photo-1509822929063-6b6cfc9b42f2",
    "image_source": "unsplash",
    "alt_text": "필요한 것을 찾는 모습",
    "context": "필요와 요구"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0013-00000000000c',
  'a1000001-0001-0001-0001-000000000013',
  'example_sentence',
  '{
    "word": "brauchen",
    "example_sentence": "Ich brauche Zeit",
    "translation": {
      "ko": "나는 시간이 필요하다",
      "en": "I need time"
    },
    "pattern": "Ich brauche + [명사]",
    "variations": [
      "Ich brauche Hilfe (나는 도움이 필요하다)",
      "Brauchst du Geld? (너는 돈이 필요하니?)"
    ]
  }'::jsonb,
  3,
  true
);

-- ========== bleiben (머물다) ==========
-- Card A: 의미 + 발음
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0014-00000000000a',
  'a1000001-0001-0001-0001-000000000014',
  'meaning_pronunciation',
  '{
    "word": "bleiben",
    "meaning": {
      "ko": "머물다, 남다",
      "en": "to stay, to remain"
    },
    "tts_text": "bleiben",
    "phonetic": "[ˈblaɪbən]",
    "conjugation": {
      "ich": "bleibe",
      "du": "bleibst",
      "er/sie/es": "bleibt",
      "wir": "bleiben",
      "Sie": "bleiben"
    }
  }'::jsonb,
  1,
  true
);

-- Card B: 이미지
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0014-00000000000b',
  'a1000001-0001-0001-0001-000000000014',
  'image',
  '{
    "word": "bleiben",
    "image_url": "https://images.unsplash.com/photo-1522071820081-009f0129c71c",
    "image_source": "unsplash",
    "alt_text": "한 곳에 머무는 모습",
    "context": "지속과 체류"
  }'::jsonb,
  2,
  true
);

-- Card C: 예문
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0001-0001-0014-00000000000c',
  'a1000001-0001-0001-0001-000000000014',
  'example_sentence',
  '{
    "word": "bleiben",
    "example_sentence": "Ich bleibe hier",
    "translation": {
      "ko": "나는 여기 머문다",
      "en": "I stay here"
    },
    "pattern": "Ich bleibe + [장소]",
    "variations": [
      "Ich bleibe zu Hause (나는 집에 있다)",
      "Bleibst du heute? (너는 오늘 머무니?)"
    ]
  }'::jsonb,
  3,
  true
);

-- ============================================
-- 5. learning_card: 대명사 5개 × 2 카드 = 10개
-- ============================================

-- ========== ich (나) ==========
-- Card A: 형태
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0002-0002-0001-00000000000a',
  'a1000001-0002-0002-0002-000000000001',
  'meaning_pronunciation',
  '{
    "word": "ich",
    "meaning": {
      "ko": "나",
      "en": "I"
    },
    "tts_text": "ich",
    "phonetic": "[ɪç]",
    "usage": "1인칭 단수 주격",
    "note": "문장 시작이 아니어도 항상 소문자"
  }'::jsonb,
  1,
  true
);

-- Card B: 결합
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0002-0002-0001-00000000000b',
  'a1000001-0002-0002-0002-000000000001',
  'example_sentence',
  '{
    "word": "ich",
    "pattern": "ich + 동사",
    "examples": [
      {
        "sentence": "Ich bin hier",
        "translation": {
          "ko": "나는 여기 있다",
          "en": "I am here"
        }
      },
      {
        "sentence": "Ich gehe",
        "translation": {
          "ko": "나는 간다",
          "en": "I go"
        }
      }
    ]
  }'::jsonb,
  2,
  true
);

-- ========== du (너) ==========
-- Card A: 형태
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0002-0002-0002-00000000000a',
  'a1000001-0002-0002-0002-000000000002',
  'meaning_pronunciation',
  '{
    "word": "du",
    "meaning": {
      "ko": "너 (친밀한 관계)",
      "en": "you (informal)"
    },
    "tts_text": "du",
    "phonetic": "[duː]",
    "usage": "2인칭 단수 주격 (친구, 가족)",
    "note": "친한 사람에게만 사용"
  }'::jsonb,
  1,
  true
);

-- Card B: 결합
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0002-0002-0002-00000000000b',
  'a1000001-0002-0002-0002-000000000002',
  'example_sentence',
  '{
    "word": "du",
    "pattern": "du + 동사 (주로 -st 어미)",
    "examples": [
      {
        "sentence": "Was machst du?",
        "translation": {
          "ko": "너는 무엇을 하니?",
          "en": "What do you do?"
        }
      },
      {
        "sentence": "Kommst du?",
        "translation": {
          "ko": "너는 오니?",
          "en": "Do you come?"
        }
      }
    ]
  }'::jsonb,
  2,
  true
);

-- ========== er (그) ==========
-- Card A: 형태
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0002-0002-0003-00000000000a',
  'a1000001-0002-0002-0002-000000000003',
  'meaning_pronunciation',
  '{
    "word": "er",
    "meaning": {
      "ko": "그 (남성)",
      "en": "he"
    },
    "tts_text": "er",
    "phonetic": "[eːɐ̯]",
    "usage": "3인칭 남성 단수 주격",
    "note": "남성 명사를 가리킬 때도 사용"
  }'::jsonb,
  1,
  true
);

-- Card B: 결합
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0002-0002-0003-00000000000b',
  'a1000001-0002-0002-0002-000000000003',
  'example_sentence',
  '{
    "word": "er",
    "pattern": "er + 동사 (주로 -t 어미)",
    "examples": [
      {
        "sentence": "Er kommt",
        "translation": {
          "ko": "그는 온다",
          "en": "He comes"
        }
      },
      {
        "sentence": "Er ist hier",
        "translation": {
          "ko": "그는 여기 있다",
          "en": "He is here"
        }
      }
    ]
  }'::jsonb,
  2,
  true
);

-- ========== Sie (당신) ==========
-- Card A: 형태
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0002-0002-0004-00000000000a',
  'a1000001-0002-0002-0002-000000000004',
  'meaning_pronunciation',
  '{
    "word": "Sie",
    "meaning": {
      "ko": "당신 (존칭)",
      "en": "you (formal)"
    },
    "tts_text": "Sie",
    "phonetic": "[ziː]",
    "usage": "2인칭 존칭 (단수/복수)",
    "note": "항상 대문자로 시작, 공손한 표현"
  }'::jsonb,
  1,
  true
);

-- Card B: 결합
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0002-0002-0004-00000000000b',
  'a1000001-0002-0002-0002-000000000004',
  'example_sentence',
  '{
    "word": "Sie",
    "pattern": "Sie + 동사 (복수형과 동일)",
    "examples": [
      {
        "sentence": "Was sagen Sie?",
        "translation": {
          "ko": "당신은 무엇을 말합니까?",
          "en": "What do you say?"
        }
      },
      {
        "sentence": "Kommen Sie?",
        "translation": {
          "ko": "오십니까?",
          "en": "Do you come?"
        }
      }
    ]
  }'::jsonb,
  2,
  true
);

-- ========== wir (우리) ==========
-- Card A: 형태
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0002-0002-0005-00000000000a',
  'a1000001-0002-0002-0002-000000000005',
  'meaning_pronunciation',
  '{
    "word": "wir",
    "meaning": {
      "ko": "우리",
      "en": "we"
    },
    "tts_text": "wir",
    "phonetic": "[viːɐ̯]",
    "usage": "1인칭 복수 주격",
    "note": "동사 원형과 같은 형태"
  }'::jsonb,
  1,
  true
);

-- Card B: 결합
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0002-0002-0005-00000000000b',
  'a1000001-0002-0002-0002-000000000005',
  'example_sentence',
  '{
    "word": "wir",
    "pattern": "wir + 동사 (원형과 동일)",
    "examples": [
      {
        "sentence": "Wir gehen",
        "translation": {
          "ko": "우리는 간다",
          "en": "We go"
        }
      },
      {
        "sentence": "Wir sind hier",
        "translation": {
          "ko": "우리는 여기 있다",
          "en": "We are here"
        }
      }
    ]
  }'::jsonb,
  2,
  true
);

-- ============================================
-- 6. learning_card: 시간/숫자 5개 × 2 카드 = 10개
-- ============================================

-- ========== heute (오늘) ==========
-- Card A: 의미
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0003-0003-0001-00000000000a',
  'a1000001-0003-0003-0003-000000000001',
  'meaning_pronunciation',
  '{
    "word": "heute",
    "meaning": {
      "ko": "오늘",
      "en": "today"
    },
    "tts_text": "heute",
    "phonetic": "[ˈhɔʏtə]",
    "usage": "시간 부사"
  }'::jsonb,
  1,
  true
);

-- Card B: 결합
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0003-0003-0001-00000000000b',
  'a1000001-0003-0003-0003-000000000001',
  'example_sentence',
  '{
    "word": "heute",
    "examples": [
      {
        "sentence": "Ich komme heute",
        "translation": {
          "ko": "나는 오늘 온다",
          "en": "I come today"
        }
      },
      {
        "sentence": "Was machst du heute?",
        "translation": {
          "ko": "너는 오늘 뭐해?",
          "en": "What do you do today?"
        }
      }
    ]
  }'::jsonb,
  2,
  true
);

-- ========== jetzt (지금) ==========
-- Card A: 의미
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0003-0003-0002-00000000000a',
  'a1000001-0003-0003-0003-000000000002',
  'meaning_pronunciation',
  '{
    "word": "jetzt",
    "meaning": {
      "ko": "지금, 이제",
      "en": "now"
    },
    "tts_text": "jetzt",
    "phonetic": "[jɛtst]",
    "usage": "시간 부사"
  }'::jsonb,
  1,
  true
);

-- Card B: 결합
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0003-0003-0002-00000000000b',
  'a1000001-0003-0003-0003-000000000002',
  'example_sentence',
  '{
    "word": "jetzt",
    "examples": [
      {
        "sentence": "Ich gehe jetzt",
        "translation": {
          "ko": "나는 지금 간다",
          "en": "I go now"
        }
      },
      {
        "sentence": "Was machst du jetzt?",
        "translation": {
          "ko": "너는 지금 뭐해?",
          "en": "What do you do now?"
        }
      }
    ]
  }'::jsonb,
  2,
  true
);

-- ========== oft (자주) ==========
-- Card A: 의미
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0003-0003-0003-00000000000a',
  'a1000001-0003-0003-0003-000000000003',
  'meaning_pronunciation',
  '{
    "word": "oft",
    "meaning": {
      "ko": "자주, 종종",
      "en": "often"
    },
    "tts_text": "oft",
    "phonetic": "[ɔft]",
    "usage": "빈도 부사"
  }'::jsonb,
  1,
  true
);

-- Card B: 결합
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0003-0003-0003-00000000000b',
  'a1000001-0003-0003-0003-000000000003',
  'example_sentence',
  '{
    "word": "oft",
    "examples": [
      {
        "sentence": "Ich komme oft",
        "translation": {
          "ko": "나는 자주 온다",
          "en": "I come often"
        }
      },
      {
        "sentence": "Er trinkt oft Kaffee",
        "translation": {
          "ko": "그는 자주 커피를 마신다",
          "en": "He often drinks coffee"
        }
      }
    ]
  }'::jsonb,
  2,
  true
);

-- ========== immer (항상) ==========
-- Card A: 의미
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0003-0003-0004-00000000000a',
  'a1000001-0003-0003-0003-000000000004',
  'meaning_pronunciation',
  '{
    "word": "immer",
    "meaning": {
      "ko": "항상, 언제나",
      "en": "always"
    },
    "tts_text": "immer",
    "phonetic": "[ˈɪmɐ]",
    "usage": "빈도 부사"
  }'::jsonb,
  1,
  true
);

-- Card B: 결합
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0003-0003-0004-00000000000b',
  'a1000001-0003-0003-0003-000000000004',
  'example_sentence',
  '{
    "word": "immer",
    "examples": [
      {
        "sentence": "Ich bin immer hier",
        "translation": {
          "ko": "나는 항상 여기 있다",
          "en": "I am always here"
        }
      },
      {
        "sentence": "Sie kommt immer",
        "translation": {
          "ko": "그녀는 항상 온다",
          "en": "She always comes"
        }
      }
    ]
  }'::jsonb,
  2,
  true
);

-- ========== eins (1) ==========
-- Card A: 의미
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0003-0003-0005-00000000000a',
  'a1000001-0003-0003-0003-000000000005',
  'meaning_pronunciation',
  '{
    "word": "eins",
    "meaning": {
      "ko": "1, 하나",
      "en": "one"
    },
    "tts_text": "eins",
    "phonetic": "[aɪns]",
    "usage": "기수",
    "note": "ein/eine/einen으로 변화"
  }'::jsonb,
  1,
  true
);

-- Card B: 결합
INSERT INTO "learning_card" (id, learning_content_id, card_type, card_data, display_order, is_active)
VALUES (
  'c1000001-0003-0003-0005-00000000000b',
  'a1000001-0003-0003-0003-000000000005',
  'example_sentence',
  '{
    "word": "eins",
    "examples": [
      {
        "sentence": "Ich habe ein Buch",
        "translation": {
          "ko": "나는 책 한 권이 있다",
          "en": "I have one book"
        }
      },
      {
        "sentence": "Es ist ein Uhr",
        "translation": {
          "ko": "한 시이다",
          "en": "It is one o clock"
        }
      }
    ]
  }'::jsonb,
  2,
  true
);

-- ============================================
-- 완료!
-- 총 생성된 카드 수:
-- - 동사 14개 × 3카드 = 42개
-- - 대명사 5개 × 2카드 = 10개
-- - 시간/숫자 5개 × 2카드 = 10개
-- 합계: 62개 학습 카드
-- ============================================