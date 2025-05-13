import { Module } from '@nestjs/common';
import { VisualRepresentationService } from './visual-representation.service';
import { VisualRepresentationController } from './visual-representation.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExperienceAR, Image, Model3D, VisualRepresentation } from './entities';
import { ProductsModule } from '../products/products.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [VisualRepresentationController],
  providers: [VisualRepresentationService],
  imports: [
    TypeOrmModule.forFeature([
      VisualRepresentation,
      Image,
      Model3D,
      ExperienceAR,
    ]),
    ProductsModule,
    AuthModule,
  ],
  exports: [TypeOrmModule],
})
export class VisualRepresentationModule {}
