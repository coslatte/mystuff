package com.cosmiclatte.dev.cosmiclatteweb.repository;

import com.cosmiclatte.dev.cosmiclatteweb.model.Song;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SongRepository extends JpaRepository<Song, Long> {

    List<Song> findByCategoryOrderByCreatedAtDesc(String category);

    List<Song> findAllByOrderByCreatedAtDesc();
}
