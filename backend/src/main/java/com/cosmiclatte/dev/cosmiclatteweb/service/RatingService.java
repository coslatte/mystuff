package com.cosmiclatte.dev.cosmiclatteweb.service;

import com.cosmiclatte.dev.cosmiclatteweb.dto.RatingResponse;
import com.cosmiclatte.dev.cosmiclatteweb.model.Rating;
import com.cosmiclatte.dev.cosmiclatteweb.model.Song;
import com.cosmiclatte.dev.cosmiclatteweb.repository.RatingRepository;
import com.cosmiclatte.dev.cosmiclatteweb.repository.SongRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RatingService {

    private final RatingRepository ratingRepository;
    private final SongRepository songRepository;

    public RatingService(RatingRepository ratingRepository, SongRepository songRepository) {
        this.ratingRepository = ratingRepository;
        this.songRepository = songRepository;
    }

    @Transactional
    public RatingResponse addRating(Long songId, int stars) {
        if (stars < 1 || stars > 5) {
            throw new IllegalArgumentException("La valoración debe estar entre 1 y 5 estrellas.");
        }
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Canción no encontrada: " + songId));
        Rating rating = new Rating();
        rating.setSong(song);
        rating.setStars(stars);
        Rating saved = ratingRepository.save(rating);
        return new RatingResponse(saved.getId(), songId, saved.getStars(), saved.getCreatedAt());
    }
}
