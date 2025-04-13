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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid-roles.interface';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../auth/entities/user.entity';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('create')
  @Auth(ValidRoles.VENDOR)
  create(@GetUser() user: User, @Body() createProductDto: CreateProductDto) {
    return this.productsService.create(user.id, createProductDto);
  }

  @Get('consumer-products')
  findAll() {
    return this.productsService.findAll();
  }

  @Get('vendor-products')
  @Auth(ValidRoles.VENDOR)
  findAllProductsVendor(@GetUser() user: User) {
    return this.productsService.findAllProductsVendor(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch('update-product/:id')
  @Auth(ValidRoles.VENDOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(user.id, id, updateProductDto);
  }

  @Delete('delete-product/:id')
  @Auth(ValidRoles.VENDOR)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
