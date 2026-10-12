package com.cosmiclatte.dev.portfolio.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.cosmiclatte.dev.portfolio.common.exception.NotFoundException;
import com.cosmiclatte.dev.portfolio.dto.RatingResponse;
import com.cosmiclatte.dev.portfolio.mapper.RatingMapper;
import com.cosmiclatte.dev.portfolio.model.Rating;
import com.cosmiclatte.dev.portfolio.model.Song;
import com.cosmiclatte.dev.portfolio.repository.RatingRepository;
import com.cosmiclatte.dev.portfolio.repository.SongRepository;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RatingService {

    private final RatingRepository ratingRepository;
    private final SongRepository songRepository;
    private final RatingMapper ratingMapper;

    @Transactional
    public RatingResponse addRating(Long songId, int stars, String visitorId, String ipHash) {
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new NotFoundException("Song not found: " + songId));

        String effectiveVisitorId = (visitorId == null || visitorId.isBlank())
                ? UUID.randomUUID().toString()
                : visitorId.trim();
        String effectiveIpHash = (ipHash == null || ipHash.isBlank()) ? null : ipHash;

        Rating existing = findExisting(songId, effectiveVisitorId, effectiveIpHash);
        if (existing != null) {
            existing.setStars(stars);
            return ratingMapper.toResponse(ratingRepository.save(existing));
        }

        Rating rating = Rating.builder()
                .song(song)
                .stars(stars)
                .visitorId(effectiveVisitorId)
                .ipHash(effectiveIpHash)
                .build();
        // saveAndFlush, not save: V6's unique indexes have to raise here rather
        // than at commit, where nothing could catch it and turn it into a 409.
        return ratingMapper.toResponse(ratingRepository.saveAndFlush(rating));
    }

    /**
     * V6 adds a unique index on (song_id, ip_hash) next to the existing one on
     * (song_id, visitor_id), so a repeat vote from the same browser or the same
     * network updates the stored stars instead of inserting a second row.
     * Visitors behind one NAT address share a single vote per song.
     */
    private Rating findExisting(Long songId, String visitorId, String ipHash) {
        Rating byVisitor = ratingRepository.findBySongIdAndVisitorId(songId, visitorId);
        if (byVisitor != null) {
            return byVisitor;
        }
        return ipHash == null ? null : ratingRepository.findBySongIdAndIpHash(songId, ipHash);
    }
}