package com.cosmiclatte.dev.cosmiclatteweb.repository;

import com.cosmiclatte.dev.cosmiclatteweb.model.Rating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface RatingRepository extends JpaRepository<Rating, Long> {

    List<Rating> findBySongIdOrderByCreatedAtAsc(Long songId);

    Rating findBySongIdAndVisitorId(Long songId, String visitorId);

    Rating findBySongIdAndIpHash(Long songId, String ipHash);

    @Query("""
            select r.song.id as songId, count(r) as total, avg(r.stars) as average
            from Rating r
            where r.song.id in :songIds
            group by r.song.id
            """)
    List<SongRatingSummary> summarizeBySongIds(@Param("songIds") Collection<Long> songIds);

    @Query("""
            select r.song.id as songId, r.visitorId as visitorId, r.ipHash as ipHash, r.stars as stars
            from Rating r
            where r.song.id in :songIds
              and ((:visitorId is not null and r.visitorId = :visitorId)
                   or (:ipHash is not null and r.ipHash = :ipHash))
            """)
    List<MyRating> findMineForSongs(
            @Param("songIds") Collection<Long> songIds,
            @Param("visitorId") String visitorId,
            @Param("ipHash") String ipHash);

    interface SongRatingSummary {
        Long getSongId();

        long getTotal();

        Double getAverage();
    }

    interface MyRating {
        Long getSongId();

        String getVisitorId();

        String getIpHash();

        Integer getStars();
    }
}
