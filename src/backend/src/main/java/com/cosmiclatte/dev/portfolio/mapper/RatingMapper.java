package com.cosmiclatte.dev.portfolio.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

import com.cosmiclatte.dev.portfolio.dto.RatingResponse;
import com.cosmiclatte.dev.portfolio.model.Rating;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface RatingMapper {

    @Mapping(target = "songId", source = "song.id")
    RatingResponse toResponse(Rating rating);
}
