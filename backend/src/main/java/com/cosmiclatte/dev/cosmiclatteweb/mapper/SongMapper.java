package com.cosmiclatte.dev.cosmiclatteweb.mapper;

import com.cosmiclatte.dev.cosmiclatteweb.dto.SongResponse;
import com.cosmiclatte.dev.cosmiclatteweb.model.Song;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface SongMapper {

    @Mapping(target = "audioUrl", ignore = true)
    @Mapping(target = "avgRating", ignore = true)
    @Mapping(target = "totalVotes", ignore = true)
    @Mapping(target = "myRating", ignore = true)
    SongResponse toResponse(Song song);

    default SongResponse toResponse(Song song, String audioUrl, Double avgRating, Long totalVotes, Integer myRating) {
        SongResponse response = toResponse(song);
        return new SongResponse(
                response.id(),
                response.title(),
                response.artist(),
                response.duration(),
                audioUrl,
                response.createdAt(),
                avgRating,
                totalVotes,
                myRating);
    }
}
