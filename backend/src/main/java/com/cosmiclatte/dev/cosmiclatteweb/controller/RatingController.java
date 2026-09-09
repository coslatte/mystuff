package com.cosmiclatte.dev.cosmiclatteweb.controller;

import com.cosmiclatte.dev.cosmiclatteweb.dto.CreateRatingRequest;
import com.cosmiclatte.dev.cosmiclatteweb.dto.RatingResponse;
import com.cosmiclatte.dev.cosmiclatteweb.service.RatingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class RatingController {

    private final RatingService ratingService;

    public RatingController(RatingService ratingService) {
        this.ratingService = ratingService;
    }

    @PostMapping("/songs/{songId}/ratings")
    public ResponseEntity<RatingResponse> addRating(
            @PathVariable Long songId,
            @RequestBody CreateRatingRequest request) {
        RatingResponse rating = ratingService.addRating(songId, request.stars());
        return ResponseEntity.status(HttpStatus.CREATED).body(rating);
    }
}
