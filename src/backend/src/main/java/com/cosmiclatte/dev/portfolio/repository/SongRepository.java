package com.cosmiclatte.dev.portfolio.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.cosmiclatte.dev.portfolio.model.Song;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface SongRepository extends JpaRepository<Song, Long> {

    List<Song> findAllByOrderByCreatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Song s where s.id = :id")
    Optional<Song> findForUpdate(@Param("id") Long id);
}
