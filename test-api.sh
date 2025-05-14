#!/bin/bash

BASE_URL="http://localhost:3000/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing PII Encryption API...${NC}"

# Function to make API requests and display results
make_request() {
  METHOD=$1
  ENDPOINT=$2
  DATA=$3
  DESCRIPTION=$4

  echo -e "\n${YELLOW}$DESCRIPTION${NC}"
  echo -e "Method: $METHOD"
  echo -e "Endpoint: $ENDPOINT"
  
  if [ -n "$DATA" ]; then
    echo -e "Data: $DATA"
    RESPONSE=$(curl -s -X $METHOD "$BASE_URL$ENDPOINT" \
      -H "Content-Type: application/json" \
      -d "$DATA")
  else
    RESPONSE=$(curl -s -X $METHOD "$BASE_URL$ENDPOINT")
  fi

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Response:${NC}"
    echo $RESPONSE | jq . || echo $RESPONSE
  else
    echo -e "${RED}Error making request${NC}"
  fi
}

# 1. Create a user
USER_DATA='{"first_name":"John","last_name":"Doe","email":"john.doe@example.com"}'
make_request "POST" "/users" "$USER_DATA" "Creating a new user"

# Store the user ID for subsequent requests
USER_ID=$(echo $RESPONSE | jq -r '.id' 2>/dev/null)

# 2. Get all users
make_request "GET" "/users" "" "Retrieving all users"

# 3. Get specific user
if [ -n "$USER_ID" ]; then
  make_request "GET" "/users/$USER_ID" "" "Retrieving user with ID $USER_ID"
fi

# 4. Update user
if [ -n "$USER_ID" ]; then
  UPDATE_DATA='{"first_name":"John","last_name":"Updated","email":"john.updated@example.com"}'
  make_request "PUT" "/users/$USER_ID" "$UPDATE_DATA" "Updating user with ID $USER_ID"
fi

# 5. Create a payment
if [ -n "$USER_ID" ]; then
  PAYMENT_DATA="{\"user_id\":\"$USER_ID\",\"card_number\":\"4111111111111111\",\"cvv\":\"123\"}"
  make_request "POST" "/payments" "$PAYMENT_DATA" "Creating a new payment"
  
  # Store the payment ID
  PAYMENT_ID=$(echo $RESPONSE | jq -r '.id' 2>/dev/null)
fi

# 6. Get all payments
make_request "GET" "/payments" "" "Retrieving all payments"

# 7. Get specific payment
if [ -n "$PAYMENT_ID" ]; then
  make_request "GET" "/payments/$PAYMENT_ID" "" "Retrieving payment with ID $PAYMENT_ID"
fi

# 8. Update payment
if [ -n "$PAYMENT_ID" ]; then
  UPDATE_PAYMENT_DATA='{"card_number":"4242424242424242","cvv":"456"}'
  make_request "PUT" "/payments/$PAYMENT_ID" "$UPDATE_PAYMENT_DATA" "Updating payment with ID $PAYMENT_ID"
fi

# Uncomment to test deletion (disabled by default to keep data for inspection)
# if [ -n "$PAYMENT_ID" ]; then
#   make_request "DELETE" "/payments/$PAYMENT_ID" "" "Deleting payment with ID $PAYMENT_ID"
# fi
#
# if [ -n "$USER_ID" ]; then
#   make_request "DELETE" "/users/$USER_ID" "" "Deleting user with ID $USER_ID"
# fi

echo -e "\n${GREEN}Test script completed!${NC}" 