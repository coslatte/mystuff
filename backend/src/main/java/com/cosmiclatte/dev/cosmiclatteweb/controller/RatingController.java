package com.cosmiclatte.dev.cosmiclatteweb.controller;

import com.cosmiclatte.dev.cosmiclatteweb.common.ApiPaths;
import com.cosmiclatte.dev.cosmiclatteweb.common.dto.ResponseFormat;
import com.cosmiclatte.dev.cosmiclatteweb.dto.CreateRatingRequest;
import com.cosmiclatte.dev.cosmiclatteweb.dto.RatingResponse;
import com.cosmiclatte.dev.cosmiclatteweb.service.RatingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

@RestController
@RequestMapping(ApiPaths.API)
@RequiredArgsConstructor
public class RatingController {

    private final RatingService ratingService;

    @PostMapping(ApiPaths.SONG_RATINGS)
    public ResponseEntity<?> addRating(
            @PathVariable Long songId,
            @Valid @RequestBody CreateRatingRequest request,
            @RequestHeader(value = "X-Forwarded-For", required = false) String forwardedFor,
            HttpServletRequest httpRequest) {
        String ipHash = hashIp(resolveClientIp(forwardedFor, httpRequest));
        RatingResponse rating = ratingService.addRating(songId, request.stars(), request.visitorId(), ipHash);
        return ResponseEntity.status(HttpStatus.CREATED).body(ResponseFormat.success(rating));
    }

    @GetMapping(ApiPaths.SONG_RATINGS + "/mine")
    public ResponseEntity<?> getMine(
            @PathVariable Long songId,
            @RequestParam(value = "visitorId", required = false) String visitorId,
            @RequestHeader(value = "X-Forwarded-For", required = false) String forwardedFor,
            HttpServletRequest httpRequest) {
        String ipHash = hashIp(resolveClientIp(forwardedFor, httpRequest));
        return ResponseEntity.ok(ResponseFormat.success(ratingService.getVisitorStars(songId, visitorId, ipHash)));
    }

    private static String resolveClientIp(String forwardedFor, HttpServletRequest request) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static String hashIp(String ip) {
        if (ip == null || ip.isBlank()) return null;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(ip.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            return null;
        }
    }
}
