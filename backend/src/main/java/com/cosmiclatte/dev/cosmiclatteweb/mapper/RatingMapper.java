package com.cosmiclatte.dev.cosmiclatteweb.mapper;

import com.cosmiclatte.dev.cosmiclatteweb.dto.RatingResponse;
import com.cosmiclatte.dev.cosmiclatteweb.model.Rating;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface RatingMapper {

    @Mapping(target = "songId", source = "song.id")
    RatingResponse toResponse(Rating rating);
}
