package com.cosmiclatte.dev.portfolio.mapper;

import com.cosmiclatte.dev.portfolio.dto.ContactAcceptedResponse;
import com.cosmiclatte.dev.portfolio.dto.CreateContactMessageRequest;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface ContactMapper {
    @Mapping(target = "status", constant = "accepted")
    ContactAcceptedResponse toAcceptedResponse(UUID messageId);

    default String toGmailPayload(UUID messageId, CreateContactMessageRequest request,
                                  String from, String to, Instant createdAt, ObjectMapper json) {
        String domain = from.substring(from.lastIndexOf('@') + 1);
        String body = "Name: " + request.name() + "\nEmail: " + request.email() + "\nDate: " + createdAt
                + "\nReference: " + messageId + "\n\n" + request.message();
        String encodedBody = Base64.getMimeEncoder(76, "\r\n".getBytes(StandardCharsets.US_ASCII))
                .encodeToString(body.getBytes(StandardCharsets.UTF_8));
        String mime = "From: " + from + "\r\nTo: " + to + "\r\nReply-To: " + request.email()
                + "\r\nSubject: Portfolio contact - " + messageId
                + "\r\nMessage-ID: <contact." + messageId + "@" + domain + ">"
                + "\r\nDate: " + DateTimeFormatter.RFC_1123_DATE_TIME.format(createdAt.atZone(ZoneOffset.UTC))
                + "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8"
                + "\r\nContent-Transfer-Encoding: base64\r\n\r\n" + encodedBody + "\r\n";
        return json.writeValueAsString(Map.of("raw", Base64.getUrlEncoder().withoutPadding()
                .encodeToString(mime.getBytes(StandardCharsets.US_ASCII))));
    }
}
