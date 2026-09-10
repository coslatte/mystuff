package com.cosmiclatte.dev.cosmiclatteweb.repository;

import com.cosmiclatte.dev.cosmiclatteweb.model.Rating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RatingRepository extends JpaRepository<Rating, Long> {

    List<Rating> findBySongIdOrderByCreatedAtAsc(Long songId);

    Rating findBySongIdAndVisitorId(Long songId, String visitorId);

    Rating findBySongIdAndIpHash(Long songId, String ipHash);

    long countBySongId(Long songId);

    @Query("select coalesce(avg(r.stars), 0) from Rating r where r.song = :song")
    double avgStars(@Param("song") com.cosmiclatte.dev.cosmiclatteweb.model.Song song);
}
