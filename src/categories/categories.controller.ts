import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid-roles.interface';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post('create')
  @Auth(ValidRoles.VENDOR)
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @Auth()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @Auth(ValidRoles.VENDOR)
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Get('subcategorias/:id')
  @Auth(ValidRoles.VENDOR)
  findSubcategorias(@Param('id') id: string) {
    return this.categoriesService.findDirectSubcategories(id);
  }

  @Patch('update/:id')
  @Auth(ValidRoles.VENDOR)
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete('delete/:id')
  @Auth(ValidRoles.VENDOR)
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
