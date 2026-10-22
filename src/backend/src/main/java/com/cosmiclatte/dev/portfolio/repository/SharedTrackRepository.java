package com.cosmiclatte.dev.portfolio.repository;

import com.cosmiclatte.dev.portfolio.model.SharedTrack;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SharedTrackRepository extends JpaRepository<SharedTrack, Long> {

    Optional<SharedTrack> findBySongId(Long songId);

    Optional<SharedTrack> findByTokenAndActiveTrue(String token);
}
