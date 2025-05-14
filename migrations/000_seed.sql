
INSERT INTO public.users (first_name, last_name, email)
VALUES ('Ada','Lovelace','ada@example.com'),
       ('Grace','Hopper','grace@example.com');

INSERT INTO public.payments (user_id, card_number, cvv)
SELECT id, '4111111111111111', '123' FROM public.users WHERE email='ada@example.com';
