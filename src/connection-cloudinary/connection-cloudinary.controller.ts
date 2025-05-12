import {
  Controller,
  Post,
  Get,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
  UploadedFiles,
} from '@nestjs/common';
import { ConnectionCloudinaryService } from './connection-cloudinary.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

@Controller('cloudinary')
export class ConnectionCloudinaryController {
  constructor(
    private readonly connectionCloudinaryService: ConnectionCloudinaryService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException(
        'No se proporcionó ningún archivo',
        HttpStatus.BAD_REQUEST,
      );
    }

    const imageUrl = await this.connectionCloudinaryService.uploadImage(file);
    return { message: 'Imagen subida correctamente', imageUrl };
  }

  @Get()
  async listImages() {
    try {
      const images = await this.connectionCloudinaryService.listImages();
      return { message: 'Imágenes listadas correctamente', images };
    } catch (error) {
      throw new HttpException(
        'Error al listar las imágenes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':imageId')
  async getImage(@Param('imageId') imageId: string) {
    if (!imageId) {
      throw new HttpException(
        'El parámetro "imageId" es requerido',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const imageUrl = await this.connectionCloudinaryService.getImage(imageId);
      return { message: 'Imagen obtenida correctamente', url: imageUrl };
    } catch (error) {
      throw new HttpException(
        'Error al obtener la imagen o imagen no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Delete(':imageId')
  async deleteImage(@Param('imageId') imageId: string) {
    if (!imageId) {
      throw new HttpException(
        'El parámetro "imageId" es requerido',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.connectionCloudinaryService.deleteImage(imageId);
      return { message: 'Imagen eliminada correctamente' };
    } catch (error) {
      throw new HttpException(
        'Error al eliminar la imagen',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadMultipleImages(@UploadedFiles() files: Express.Multer.File[]) {
    console.log("LLEGAAAAAAAAA")
    if (!files || files.length === 0) {
      return { images: [] }; // Retorna un JSON vacío si no hay archivos
    }

    try {
      const uploadedImages =
        await this.connectionCloudinaryService.uploadMultipleImages(files);
      return { images: uploadedImages }; // Retorna un JSON con las URLs
    } catch (error) {
      throw new HttpException(
        'Error al subir las imágenes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
