package com.cosmiclatte.dev.portfolio.repository;

import com.cosmiclatte.dev.portfolio.common.exception.ContactException;
import com.cosmiclatte.dev.portfolio.dto.CreateContactMessageRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class ContactRepository {
    private final JdbcTemplate jdbc;

    public record Receipt(UUID id, String fingerprint) { }
    public enum Channel { EMAIL, TELEGRAM }
    public enum State { PENDING, PROCESSING, PROVIDER_ACCEPTED, FAILED, REQUIRES_REVIEW }
    public record Delivery(UUID id, Channel channel, String payload, int attempts,
                           Instant firstAttempt, UUID lease, boolean uncertain) { }

    public Receipt findAndLock(UUID submissionId) {
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", rs -> { }, submissionId.toString());
        var rows = jdbc.query("SELECT id, fingerprint FROM contact_messages WHERE submission_id = ?",
                (rs, n) -> new Receipt(rs.getObject("id", UUID.class), rs.getString("fingerprint")), submissionId);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public void consumeLimit(String scope, Instant start, Instant expires, int limit) {
        var counts = jdbc.query("""
                INSERT INTO contact_rate_limits(scope, window_start, expires_at, count)
                VALUES (?, ?, ?, 1)
                ON CONFLICT (scope, window_start) DO UPDATE
                SET count = contact_rate_limits.count + 1
                WHERE contact_rate_limits.count < ?
                RETURNING count
                """, (rs, n) -> rs.getInt(1), scope, OffsetDateTime.ofInstant(start, ZoneOffset.UTC),
                OffsetDateTime.ofInstant(expires, ZoneOffset.UTC), limit);
        if (counts.isEmpty()) {
            throw new ContactException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many messages. Please try again later.", Math.max(1, expires.getEpochSecond() - Instant.now().getEpochSecond()));
        }
    }

    public void insert(UUID id, CreateContactMessageRequest request, String fingerprint, String payload) {
        jdbc.update("""
                INSERT INTO contact_messages(id, submission_id, fingerprint, name, email, message)
                VALUES (?, ?, ?, ?, ?, ?)
                """, id, request.submissionId(), fingerprint, request.name(), request.email(), request.message());
        jdbc.update("INSERT INTO contact_deliveries(message_id, channel, payload) VALUES (?, 'EMAIL', ?)", id, payload);
    }

    public List<Delivery> claim() {
        jdbc.update("""
                UPDATE contact_deliveries SET state = 'REQUIRES_REVIEW', failure_code = 'runner_interrupted',
                    outcome_uncertain = TRUE, lease_token = NULL, lease_expires_at = NULL, updated_at = NOW()
                WHERE state = 'PROCESSING' AND lease_expires_at < NOW()
                """);
        jdbc.update("""
                UPDATE contact_deliveries SET state = 'REQUIRES_REVIEW', failure_code = 'retry_window_expired',
                    lease_token = NULL, lease_expires_at = NULL, updated_at = NOW()
                WHERE state = 'PENDING'
                  AND (first_attempt_at < NOW() - INTERVAL '23 hours' OR attempts >= 5)
                """);
        UUID lease = UUID.randomUUID();
        return jdbc.query("""
                WITH candidate AS (
                    SELECT message_id, channel FROM contact_deliveries
                    WHERE channel = 'EMAIL' AND attempts < 5
                      AND state = 'PENDING' AND next_attempt_at <= NOW()
                    ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED
                )
                UPDATE contact_deliveries d SET state = 'PROCESSING', attempts = attempts + 1,
                    first_attempt_at = COALESCE(first_attempt_at, NOW()),
                    lease_token = ?, lease_expires_at = NOW() + INTERVAL '60 seconds', updated_at = NOW()
                FROM candidate c WHERE d.message_id = c.message_id AND d.channel = c.channel
                RETURNING d.*
                """, (rs, n) -> new Delivery(rs.getObject("message_id", UUID.class),
                Channel.valueOf(rs.getString("channel")), rs.getString("payload"), rs.getInt("attempts"),
                rs.getObject("first_attempt_at", OffsetDateTime.class).toInstant(),
                rs.getObject("lease_token", UUID.class), rs.getBoolean("outcome_uncertain")), lease);
    }

    public boolean renewLease(Delivery delivery) {
        return jdbc.update("""
                UPDATE contact_deliveries SET lease_expires_at = NOW() + INTERVAL '60 seconds'
                WHERE message_id = ? AND channel = ? AND lease_token = ?
                  AND state = 'PROCESSING' AND lease_expires_at > NOW()
                """, delivery.id(), delivery.channel().name(), delivery.lease()) == 1;
    }

    public void complete(Delivery delivery, State state, String providerId, String failureCode,
                         long retrySeconds, boolean uncertain) {
        jdbc.update("""
                UPDATE contact_deliveries SET state = ?, provider_id = ?, failure_code = ?,
                    next_attempt_at = NOW() + (? * INTERVAL '1 second'),
                    outcome_uncertain = outcome_uncertain OR ?,
                    lease_token = NULL, lease_expires_at = NULL, updated_at = NOW()
                WHERE message_id = ? AND channel = ? AND lease_token = ? AND state = 'PROCESSING'
                """, state.name(), providerId, failureCode, retrySeconds, uncertain,
                delivery.id(), delivery.channel().name(), delivery.lease());
    }

    public void cleanup() {
        jdbc.update("DELETE FROM contact_rate_limits WHERE expires_at < NOW()");
        jdbc.update("""
                DELETE FROM contact_messages m WHERE created_at < NOW() - INTERVAL '30 days'
                  AND NOT EXISTS (SELECT 1 FROM contact_deliveries d WHERE d.message_id = m.id
                    AND d.state <> 'PROVIDER_ACCEPTED')
                """);
    }
}
