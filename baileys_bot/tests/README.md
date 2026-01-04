# WAHA Integration Test Suite

Comprehensive test suite for WAHA (WhatsApp HTTP API) integration in the Jesus Cristo Bot.

## Overview

- **58 tests total** across two test suites
- **100% pass rate**
- No external dependencies - pure JavaScript mocking
- Tests cover client communication, webhook handling, JID normalization, and edge cases

## Test Files

### 1. wahaClient.test.js (22 tests)

Tests the WAHA HTTP client adapter with mocking:

#### Test Categories

**Basic Message Operations (4 tests)**
- sendMessage() - successful sending
- JID normalization and handling
- Message text preservation
- Failure handling

**Session & Status (4 tests)**
- getSessionInfo() - retrieve bot info
- healthCheck() - connection validation
- markMessageAsRead() - mark messages as read
- Failure scenarios

**Retry Logic (4 tests)**
- Exponential backoff implementation
- Max retry limits
- Successful retries
- Failure after exhausting retries

**Request Validation (3 tests)**
- Correct HTTP methods (GET, POST)
- Correct API paths
- Request history tracking

**Error Handling (2 tests)**
- Network error handling
- Response delays and timeouts

**Edge Cases (5 tests)**
- Empty message text
- Special characters and emojis
- Very long messages
- Group JID format (@g.us)
- Individual JID format (@s.whatsapp.net)

### 2. webhook.test.js (36 tests)

Tests webhook payload handling and validation:

#### Test Categories

**JID Normalization (5 tests)**
- Individual JID normalization (add @s.whatsapp.net)
- Group JID normalization (add @g.us)
- Preserve already normalized JIDs
- Handle null/undefined JIDs
- Validate JID formats

**Webhook Payload Validation (9 tests)**
- Valid message payload acceptance
- Missing event field rejection
- Missing data field rejection
- Missing "from" field rejection
- Missing "body" field rejection
- Event type identification (message, ack)
- Event filtering (typing, presence)

**Webhook Processing (6 tests)**
- Valid message webhook processing
- Multiple message tracking
- Group message handling
- ACK event handling
- Unhandled event ignoring
- Invalid payload error handling

**Health Endpoint (2 tests)**
- 200 OK response for health check
- Heartbeat acceptance from WAHA

**Edge Cases & Special Handling (8 tests)**
- Very long message text (4KB+)
- Empty message body rejection
- Whitespace-only messages
- Missing pushName handling
- Special characters preservation
- Duplicate messages
- Unicode and emoji support

**Multi-User Handling (2 tests)**
- Messages from different users
- User context preservation across sessions

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:waha      # WAHA client tests only
npm run test:webhook   # Webhook handler tests only
```

## Test Fixtures

### wahaEvents.json

Contains realistic WAHA event examples for integration testing:

**Included Event Types:**
1. Simple text message
2. Normalized JID message
3. Message with emojis and special characters
4. Group message
5. Audio message
6. Location message
7. Image with caption
8. Contact/vCard
9. Long text message
10. Message ACK/delivery confirmation
11. Read receipt
12. Crisis detection (suicide indicators)
13. Follow-up responses with quoted messages

**Fixtures Provided:**
- Valid and invalid payload examples
- JID format variations
- Edge case scenarios
- Multi-step conversation scenarios

## Mock Implementation

The test files implement a `MockWahaClient` that:

- Simulates WAHA HTTP API responses without external dependencies
- Tracks all requests made
- Supports configurable failure rates for testing retry logic
- Simulates response delays for timeout testing
- Validates request payloads and paths

## Key Features Tested

### JID (Jabber ID) Handling
- ✓ Normalizes phone numbers to WhatsApp format
- ✓ Distinguishes between individual (@s.whatsapp.net) and group (@g.us) formats
- ✓ Validates JID structure and domains

### Message Processing
- ✓ Handles text, audio, image, location, contact messages
- ✓ Preserves message content (emojis, special characters)
- ✓ Supports very long messages (WhatsApp max 4096 chars)
- ✓ Handles empty/whitespace-only messages

### Retry & Resilience
- ✓ Exponential backoff on failures (100ms, 200ms, 400ms...)
- ✓ Configurable max retries
- ✓ Graceful error handling without throwing

### Webhook Validation
- ✓ Validates event type and required fields
- ✓ Handles unknown event types safely
- ✓ Tracks multiple messages per user
- ✓ Preserves user context

### Multi-User Scenarios
- ✓ Handles simultaneous messages from different users
- ✓ Maintains separate context per user
- ✓ Processes group messages correctly

## Test Output Format

Tests use colored terminal output for readability:

```
✓ sendMessage() - should send message successfully
✗ someTest() - this test failed
  Error: Expected true but got false

═══════════════════════════════════════════════════════════
Test Summary
═══════════════════════════════════════════════════════════
Total:  58
Passed: 58
Failed: 0

Success Rate: 100.00%
✓ All tests passed!
```

## Adding New Tests

To add new tests to either suite:

```javascript
// Synchronous test
test('description of what is being tested', () => {
    const result = someFunction();
    assert(result === expected, 'Error message if assertion fails');
});

// Asynchronous test
asyncTest('description of async behavior', async () => {
    const result = await someAsyncFunction();
    assertEqual(result, expected, 'Error message');
});
```

## Development Notes

- **No external test framework required** - pure JavaScript with simple assert utilities
- **Fast execution** - 58 tests run in <1 second
- **Mock flexibility** - easily configurable failure rates and delays
- **Comprehensive coverage** - tests happy path, edge cases, and error scenarios

## Related Files

- `/wahaClient.js` - WAHA HTTP adapter implementation
- `/index.js` - Main webhook receiver and processor
- `/config.js` - Configuration and environment setup
- `/.env.example` - Required environment variables for WAHA

## WAHA API Reference

For integration details, see:
- [WAHA Official Documentation](https://waha.devlike.ru/)
- `/docs/WAHA_WEBHOOK_GUIDE.md` - Local webhook configuration guide

## Future Enhancements

Potential test additions:
- [ ] Media upload/download tests
- [ ] Message reaction tests
- [ ] Status/presence update tests
- [ ] Group management tests
- [ ] Performance load tests
- [ ] Integration with real conversation controller

---

Last Updated: 2026-01-04
