
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name  VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.payments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  card_number VARCHAR(25) NOT NULL,
  cvv VARCHAR(4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
