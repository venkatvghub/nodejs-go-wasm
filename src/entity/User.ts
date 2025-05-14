import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Encrypt } from '../decorators/Encrypt.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Encrypt()
  first_name!: string;

  @Index('idx_users_first_name_key_version')
  @Column({ name: 'first_name_key_version', nullable: true, type: 'varchar', length: 100 })
  first_name_key_version?: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Encrypt()
  last_name!: string;

  @Column({ name: 'last_name_key_version', nullable: true, type: 'varchar', length: 100 })
  last_name_key_version?: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Encrypt()
  email!: string;

  @Index('idx_users_email_key_version')
  @Column({ name: 'email_key_version', nullable: true, type: 'varchar', length: 100 })
  email_key_version?: string;

  @CreateDateColumn()
  created_at!: Date;
}
