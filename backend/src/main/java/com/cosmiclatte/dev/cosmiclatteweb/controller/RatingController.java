package com.cosmiclatte.dev.cosmiclatteweb.controller;

import com.cosmiclatte.dev.cosmiclatteweb.common.ApiPaths;
import com.cosmiclatte.dev.cosmiclatteweb.common.dto.ResponseFormat;
import com.cosmiclatte.dev.cosmiclatteweb.dto.CreateRatingRequest;
import com.cosmiclatte.dev.cosmiclatteweb.dto.RatingResponse;
import com.cosmiclatte.dev.cosmiclatteweb.service.RatingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.API)
@RequiredArgsConstructor
public class RatingController {

    private final RatingService ratingService;

    @PostMapping(ApiPaths.SONG_RATINGS)
    public ResponseEntity<ResponseFormat<?>> addRating(
            @PathVariable Long songId,
            @Valid @RequestBody CreateRatingRequest request) {
        RatingResponse rating = ratingService.addRating(songId, request.stars());
        return ResponseEntity.status(HttpStatus.CREATED).body(ResponseFormat.success(rating));
    }
}
