package com.cosmiclatte.dev.portfolio.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

import com.cosmiclatte.dev.portfolio.dto.SongResponse;
import com.cosmiclatte.dev.portfolio.model.Song;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface SongMapper {

    @Mapping(target = "audioUrl", ignore = true)
    @Mapping(target = "artworkUrl", ignore = true)
    @Mapping(target = "avgRating", ignore = true)
    @Mapping(target = "totalVotes", ignore = true)
    @Mapping(target = "myRating", ignore = true)
    SongResponse toResponse(Song song);

    default SongResponse toResponse(
            Song song, String audioUrl, String artworkUrl, Double avgRating, Long totalVotes, Integer myRating, long commentCount) {
        SongResponse response = toResponse(song);
        return new SongResponse(
                response.id(),
                response.title(),
                response.artist(),
                response.duration(),
                audioUrl,
                artworkUrl,
                response.createdAt(),
                avgRating,
                totalVotes,
                myRating,
                commentCount);
    }

}
