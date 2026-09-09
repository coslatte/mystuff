package com.cosmiclatte.dev.cosmiclatteweb.repository;

import com.cosmiclatte.dev.cosmiclatteweb.model.Song;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SongRepository extends JpaRepository<Song, Long> {
}
