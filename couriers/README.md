# Courier integration point

NOVA DIGITAL v4 keeps courier booking disabled until you have official courier API credentials.
For a real integration, add a provider adapter here (for example Leopards) and call it from the create-shipment endpoint.
Never put courier API secrets in frontend JavaScript. Keep them in server environment variables.
