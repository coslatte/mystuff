package com.cosmiclatte.dev.cosmiclatteweb.service;

import com.cosmiclatte.dev.cosmiclatteweb.common.exception.NotFoundException;
import com.cosmiclatte.dev.cosmiclatteweb.dto.RatingResponse;
import com.cosmiclatte.dev.cosmiclatteweb.mapper.RatingMapper;
import com.cosmiclatte.dev.cosmiclatteweb.model.Rating;
import com.cosmiclatte.dev.cosmiclatteweb.model.Song;
import com.cosmiclatte.dev.cosmiclatteweb.repository.RatingRepository;
import com.cosmiclatte.dev.cosmiclatteweb.repository.SongRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RatingService {

    private final RatingRepository ratingRepository;
    private final SongRepository songRepository;
    private final RatingMapper ratingMapper;

    @Transactional
    public RatingResponse addRating(Long songId, int stars) {
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new NotFoundException("Song not found: " + songId));
        Rating rating = Rating.builder()
                .song(song)
                .stars(stars)
                .build();
        return ratingMapper.toResponse(ratingRepository.save(rating));
    }
}
