package com.cosmiclatte.dev.portfolio.controller;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.SchemaProperty;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.web.bind.annotation.ResponseStatus;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cosmiclatte.dev.portfolio.common.ApiPaths;
import com.cosmiclatte.dev.portfolio.common.ClientIp;
import com.cosmiclatte.dev.portfolio.common.dto.ResponseFormat;
import com.cosmiclatte.dev.portfolio.dto.CreateRatingRequest;
import com.cosmiclatte.dev.portfolio.dto.RatingResponse;
import com.cosmiclatte.dev.portfolio.service.RatingService;

@RestController
@RequestMapping(ApiPaths.API)
@RequiredArgsConstructor
public class RatingController {

    private final RatingService ratingService;

    @PostMapping(ApiPaths.SONG_RATINGS)
    @ApiResponse(responseCode = "201", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", schema = @Schema(implementation = RatingResponse.class))))
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseFormat<?> addRating(
            @PathVariable Long songId,
            @Valid @RequestBody CreateRatingRequest request,
            @RequestHeader(value = "X-Forwarded-For", required = false) String forwardedFor,
            HttpServletRequest httpRequest) {
        String ipHash = ClientIp.hash(ClientIp.resolve(forwardedFor, httpRequest));
        RatingResponse rating = ratingService.addRating(songId, request.stars(), request.visitorId(), ipHash);
        return ResponseFormat.success(rating);
    }
}