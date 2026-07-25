-- Nearest-neighbor search target for character recognition: given an embedded
-- crop from a comic page, find the closest character reference image.
CREATE INDEX "CharacterReferenceImage_embedding_idx" ON "CharacterReferenceImage"
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
