# 🔒 PII-at-Rest Encryption (Node 18 + Go-WASM + PostgreSQL)

This repository is a **full scaffold** for PII encryption using Node.js, TypeORM, and Go-WASM with PostgreSQL.

## Quick Start

### Generating the AWS KMS DEK
```bash
docker-compose -f docker-compose.yaml up -d --build ## brings up postgrea and localstack
aws configure --profile localstack
AWS Access Key ID: test
AWS Secret Access Key: test
Default region name: us-east-1
Default output format: json

export AWS_PROFILE=localstack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566
```
#### Create a KMS Key
```aws --endpoint-url=$AWS_ENDPOINT_URL kms create-key  --description "Test KMS key for DEK generation"```
Copy the returned KeyId.
#### Create an alias
```aws --endpoint-url=$AWS_ENDPOINT_URL kms create-alias --alias-name alias/my-key --target-key-id <Your-Key-ID>```
####  Generate a DEK (Data Encryption Key)
```aws --endpoint-url=$AWS_ENDPOINT_URL kms generate-data-key --key-id alias/my-key --key-spec AES_256```
Output Example:
```
{
  "CiphertextBlob": "CiCw5s7Q...",
  "Plaintext": "uzrjGOWl...",
  "KeyId": "arn:aws:kms:us-east-1:000000000000:key/abcd-efgh-ijkl"
}
```
Copy over the KeyID and Encode the plaintext in base 64 and update .env and .env.example

```bash
cp .env.example .env
docker compose up --build
```

### Build the WASM Module Manually (Optional)

Ensure TinyGo 0.33.0 is installed. Run:

```bash
cd wasm
tinygo build -o ../src/crypto.wasm -target=wasi ./crypto.go
```

**Note**: If compilation fails, verify TinyGo version and ensure no `GOOS`/`GOARCH` environment variables are set. Use `tinygo version` to check.

### Running the API Server

After setting up your environment:

1. Build the WASM module (if not done already):
```bash
cd wasm
tinygo build -o ../src/crypto.wasm -target=wasi .
```

2. Start the Node.js server:
```bash
cd src
npm run dev
```

3. The server will start on port 3000 with the following endpoints:

- `GET /api/users` - List all users (decrypted)
- `GET /api/users/:id` - Get a specific user (decrypted)
- `POST /api/users` - Create a new user (data will be encrypted)
- `PUT /api/users/:id` - Update a user (data will be encrypted)
- `DELETE /api/users/:id` - Delete a user

- `GET /api/payments` - List all payments (decrypted)
- `GET /api/payments/:id` - Get a specific payment (decrypted)
- `POST /api/payments` - Create a new payment (data will be encrypted)
- `PUT /api/payments/:id` - Update a payment (data will be encrypted)
- `DELETE /api/payments/:id` - Delete a payment

4. To test the API, use the provided test script:
```bash
chmod +x test-api.sh
./test-api.sh
```

### Testing the API

#### Using the Shell Script

The repository includes a shell script (`test-api.sh`) that runs a series of API calls to test the PII encryption functionality:

1. Ensure the API server is running on `http://localhost:3000`
2. Make the script executable if it isn't already:
   ```bash
   chmod +x test-api.sh
   ```
3. Run the script:
   ```bash
   ./test-api.sh
   ```

The script will:
- Create a user with encrypted PII data
- Retrieve users (including the encrypted data)
- Update the user with new data
- Create a payment with encrypted card details
- Retrieve and update the payment

#### Using the Postman Collection

A Postman collection is also available for testing the API:

1. Import the `postman_collection.json` file into Postman
2. Create a Postman environment with the following variables:
   - `base_url`: `http://localhost:3000/api`
   - `user_id`: (leave empty, will be populated automatically)
   - `payment_id`: (leave empty, will be populated automatically)

3. Run the requests in the following order:
   - **Users > Create User**: Creates a new user with PII data and automatically stores the user_id
   - **Users > Get All Users**: Retrieves all users
   - **Users > Get User By ID**: Retrieves the specific user created
   - **Users > Update User**: Updates the user data
   - **Payments > Create Payment**: Creates a payment for the user and automatically stores the payment_id
   - **Payments > Get All Payments**: Retrieves all payments
   - **Payments > Get Payment By ID**: Retrieves the specific payment created
   - **Payments > Update Payment**: Updates the payment data

#### Sample Data

##### User Creation
```json
{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com"
}
```

##### User Update
```json
{
    "first_name": "John",
    "last_name": "Updated",
    "email": "john.updated@example.com"
}
```

##### Payment Creation
```json
{
    "user_id": "{{user_id}}",
    "card_number": "4111111111111111",
    "cvv": "123"
}
```

##### Payment Update
```json
{
    "card_number": "4242424242424242",
    "cvv": "456"
}
```

#### Verifying Encryption

When retrieving data, observe that:
1. The PII fields (first_name, last_name, email, card_number, cvv) contain encrypted values
2. The key_version fields indicate which encryption key was used
3. Despite being encrypted, the API handles all operations correctly

### Key Rotation

1. Append a new key object to `ENCRYPTION_KEYS` in `.env`.
2. Redeploy (or restart `docker compose`).
3. Run backfill to re-encrypt older rows:

```bash
docker compose exec app npm run encrypt:backfill
```

### Why Go-to-WASM?

|                         | Pure Node.js crypto | Go-WASM |
|-------------------------|---------------------|---------|
| Portability             | ✅                  | ✅ (single `.wasm`) |
| Performance             | baseline           | 2-3× faster |
| Secure sandbox          | 🟡                 | ✅ |
| Code reuse in Go svcs   | ❌                 | ✅ |
| Extra toolchain         | none               | TinyGo |

See the full documentation inside the `docs/` folder.

### Troubleshooting

- **WASM Compilation Errors**: Ensure TinyGo 0.33.0 is used. Run `tinygo build` with `-v` for verbose output.
- **Runtime Errors**: Check `.env` for valid `ENCRYPTION_KEYS` (32-byte base64 strings).
- **API Errors**: Make sure database is properly seeded and encryption key is correctly formatted.

# WASM Crypto & Node.js Backfill Guide

## Prerequisites
- Go (for building WASM)
- Node.js (v18+ recommended)
- npm
- Docker & Docker Compose (for Postgres)

## 1. Start Postgres with Docker Compose
```sh
docker-compose up -d
```

## 2. Build the WASM Crypto Module
```sh
cd nodejs-go-wasm/wasm
# Build the WASM module (ensure memory.go and crypto.go are present)
tinygo build -o ../src/crypto.wasm -target=wasi .
```

## 3. Install Node.js Dependencies
```sh
cd ../src
npm install
```

## 4. Configure TypeScript
- Ensure `tsconfig.json` contains:
  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "experimentalDecorators": true,
      "emitDecoratorMetadata": true,
      "outDir": "dist",
      "esModuleInterop": true,
      "resolveJsonModule": true,
      "strict": true,
      "skipLibCheck": true
    },
    "include": ["src"]
  }
  ```

## 5. Set Up Environment Variables
- Copy `.env.example` to `.env` and update `DATABASE_URL` to match your Postgres setup. For local Docker Compose, use:
  ```env
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/piidemo
  ENCRYPTION_ENABLED=true
  ```

## 6. Run Database Migrations (if needed)
```sh
# From the project root or migrations directory
psql postgres://postgres:postgres@localhost:5432/piidemo -f migrations/001_init.sql
psql postgres://postgres:postgres@localhost:5432/piidemo -f migrations/000_seed.sql
psql postgres://postgres:postgres@localhost:5432/piidemo -f migrations/002_encrypt_columns_json.sql
```

## 7. Run the Backfill CLI
```sh
cd nodejs-go-wasm/src
npm run encrypt:backfill
```

## Troubleshooting
- **ColumnTypeUndefinedError**: Ensure all @Column decorators in your entities specify the type.
- **getaddrinfo ENOTFOUND db**: Use `localhost` in your `DATABASE_URL` if running outside Docker Compose.
- **WASM nil pointer dereference**: Ensure you are not passing nil or empty buffers to Go WASM functions.
- **base64url import errors**: Use `import base64url from 'base64url';` and call `base64url.default(...)` for encoding.
- **TypeORM/reflect-metadata**: Ensure `import 'reflect-metadata';` is the first import in your entry file.

---

For more details, see the main project [README](../README.md).