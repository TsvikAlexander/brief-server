import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcrypt';
import { Repository } from 'typeorm';

import { AdminEntity } from './admin.entity';
import { InfoDto } from './dto/info.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import configuration from '../config/configuration';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const admin = await this.adminRepository.findOneBy({ username });

    if (!admin) {
      throw new UnauthorizedException('Неправильний нікнейм або пароль');
    }

    const passwordMatches = await compare(password, admin.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Неправильний нікнейм або пароль');
    }

    const accessToken = await this.generateAccessToken(admin);

    return { username: admin.username, accessToken };
  }

  async info(infoDto: InfoDto) {
    const { accessToken } = infoDto;
    const config = configuration();

    let jwtPayload: JwtPayload;

    try {
      jwtPayload = await this.jwtService.verifyAsync<JwtPayload>(accessToken, {
        secret: config.jwtAccess.secret,
      });
    } catch (error) {
      throw new UnauthorizedException();
    }

    const { id } = jwtPayload;
    const admin = await this.adminRepository.findOneBy({ id });

    if (!admin) {
      throw new UnauthorizedException();
    }

    return { username: admin.username, accessToken };
  }

  private generateAccessToken(admin: AdminEntity) {
    const config = configuration();

    const payload: JwtPayload = { id: admin.id };

    return this.jwtService.signAsync(payload, {
      secret: config.jwtAccess.secret,
      expiresIn: config.jwtAccess.expiresIn,
    });
  }

  existById(id: string) {
    return this.adminRepository.existsBy({ id });
  }

  existByUsername(username: string) {
    return this.adminRepository.existsBy({ username });
  }

  async register(loginDto: LoginDto) {
    const { username, password } = loginDto;

    if (await this.existByUsername(username)) {
      throw new BadRequestException('Вказаний нікнейм не є унікальним');
    }

    const hashedPassword = await hash(password, 10);

    const newAdmin = this.adminRepository.create({
      username,
      password: hashedPassword,
    });

    await this.adminRepository.save(newAdmin);
  }
}
