import { UserRole } from './../auth/dto/create-user.dto';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { VisualRepresentationService } from './visual-representation.service';
import { CreateVisualRepresentationDto } from './dto/create-visual-representation.dto';
import { UpdateVisualRepresentationDto } from './dto/update-visual-representation.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid-roles.interface';

@Controller('visual-representation')
export class VisualRepresentationController {
  constructor(
    private readonly visualRepresentationService: VisualRepresentationService,
  ) { }

  @Post()
  @Auth(ValidRoles.VENDOR)
  create(@Body() createVisualRepresentationDto: CreateVisualRepresentationDto) {
    return this.visualRepresentationService.create(
      createVisualRepresentationDto,
    );
  }

  @Get('images/:productId')
  findAllImages(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.visualRepresentationService.findAllImages(productId);
  }

  @Get('principal-image/:productId')
  findPrincipalImage(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.visualRepresentationService.findPrincipalImage(productId);
  }

  @Get('images-model3D/:productId')
  @Auth(ValidRoles.VENDOR)
  findAllImagesByModel3D(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.visualRepresentationService.findAllModel3D(productId);
  }

  @Get('images-experienceAR/:productId')
  findAllImagesByExperienceAR(
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.visualRepresentationService.findAllExperienceAR(productId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.visualRepresentationService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVisualRepresentationDto: UpdateVisualRepresentationDto,
  ) {
    return this.visualRepresentationService.update(
      +id,
      updateVisualRepresentationDto,
    );
  }

  @Delete(':id')
  @Auth(ValidRoles.VENDOR)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.visualRepresentationService.remove(id);
  }
}
