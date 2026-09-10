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

        // One vote per song per (visitor_id OR ip_hash): whichever matches first wins,
        // so voting again from the same browser (even via VPN) or the same network
        // (after clearing localStorage) updates the existing vote instead of adding one.
        Rating existing = ratingRepository.findBySongIdAndVisitorId(songId, effectiveVisitorId);
        if (existing == null && ipHash != null && !ipHash.isBlank()) {
            existing = ratingRepository.findBySongIdAndIpHash(songId, ipHash);
        }
        if (existing != null) {
            existing.setStars(stars);
            return ratingMapper.toResponse(ratingRepository.save(existing));
        }

        Rating rating = Rating.builder()
                .song(song)
                .stars(stars)
                .visitorId(effectiveVisitorId)
                .ipHash(ipHash)
                .build();
        return ratingMapper.toResponse(ratingRepository.save(rating));
    }

    public Integer getVisitorStars(Long songId, String visitorId, String ipHash) {
        if (visitorId != null && !visitorId.isBlank()) {
            Rating byVisitor = ratingRepository.findBySongIdAndVisitorId(songId, visitorId.trim());
            if (byVisitor != null) return byVisitor.getStars();
        }
        if (ipHash != null && !ipHash.isBlank()) {
            Rating byIp = ratingRepository.findBySongIdAndIpHash(songId, ipHash);
            if (byIp != null) return byIp.getStars();
        }
        return null;
    }
}
