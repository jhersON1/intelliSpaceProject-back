import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class ConnectionCloudinaryService {
  private readonly folder = 'images-sw2'; // Carpeta fija para almacenar las imágenes

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  // Subir directamente al folder images-sw1
  async uploadImage(file: Express.Multer.File): Promise<string> {
    try {
      const result = await this.uploadToCloudinary(file.buffer);
      return result.secure_url; // URL segura de la imagen
    } catch (error) {
      console.error('Error al subir la imagen a Cloudinary:', error);
      throw new HttpException(
        'Failed to upload Image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Subir múltiples imágenes
  async uploadMultipleImages(files: Express.Multer.File[]): Promise<string[]> {
    if (!files || files.length === 0) {
      throw new HttpException(
        'No se proporcionaron archivos para subir',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const uploadResults = await Promise.all(
        files.map((file) => this.uploadToCloudinary(file.buffer)),
      );
      return uploadResults.map((result) => result.secure_url); // URLs seguras de las imágenes
    } catch (error) {
      console.error('Error al subir múltiples imágenes a Cloudinary:', error);
      throw new HttpException(
        'Failed to upload multiple images',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Función para manejar el stream y convertirlo en una promesa
  private uploadToCloudinary(buffer: Buffer): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: this.folder },
        (error, result) => {
          if (error || !result)
            return reject(error || new Error('Upload failed'));
          resolve(result);
        },
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  }

  // Listar todas las imágenes desde el folder images-sw1
  async listImages(): Promise<string[]> {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload', // Tipo de recurso (subido)
        prefix: this.folder, // Carpeta específica
      });

      return result.resources.map(
        (resource: { secure_url: string }) => resource.secure_url,
      );
    } catch (error) {
      throw new HttpException(
        'Failed to list Images',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Obtener una imagen específica por ID desde el folder images-sw1
  async getImage(imageId: string): Promise<string> {
    try {
      const result = await cloudinary.api.resource(`${this.folder}/${imageId}`);
      return result.secure_url; // Devuelve la URL segura de la imagen
    } catch (error) {
      throw new HttpException('Image not found', HttpStatus.NOT_FOUND);
    }
  }

  // Eliminar una imagen específica por ID desde el folder images-sw1
  async deleteImage(imageId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(`${this.folder}/${imageId}`);
    } catch (error) {
      throw new HttpException(
        'Failed to delete Image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
