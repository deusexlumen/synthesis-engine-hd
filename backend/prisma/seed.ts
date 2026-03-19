/**
 * Database Seeding
 * Creates default roles and permissions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create permissions
  const permissions = [
    // User permissions
    { resource: 'user', action: 'read', description: 'Read user profile' },
    { resource: 'user', action: 'update', description: 'Update user profile' },
    { resource: 'user', action: 'delete', description: 'Delete user account' },
    
    // Chart permissions
    { resource: 'chart', action: 'create', description: 'Create new chart' },
    { resource: 'chart', action: 'read', description: 'Read chart data' },
    { resource: 'chart', action: 'update', description: 'Update chart' },
    { resource: 'chart', action: 'delete', description: 'Delete chart' },
    
    // AI/Coaching permissions
    { resource: 'coaching', action: 'access', description: 'Access AI coaching' },
    { resource: 'coaching', action: 'unlimited', description: 'Unlimited AI coaching' },
    
    // Export permissions
    { resource: 'export', action: 'pdf', description: 'Export as PDF' },
    { resource: 'export', action: 'png', description: 'Export as PNG' },
    { resource: 'export', action: 'svg', description: 'Export as SVG' },
    { resource: 'export', action: 'json', description: 'Export as JSON' },
    
    // Admin permissions
    { resource: 'admin', action: 'access', description: 'Access admin panel' },
    { resource: 'user', action: 'manage', description: 'Manage all users' },
    { resource: 'role', action: 'manage', description: 'Manage roles' },
    { resource: 'system', action: 'config', description: 'System configuration' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: {},
      create: perm,
    });
  }

  console.log(`✅ Created ${permissions.length} permissions`);

  // Create roles with permissions
  const roles = [
    {
      name: 'USER',
      description: 'Standard user role',
      permissions: [
        { resource: 'user', action: 'read' },
        { resource: 'user', action: 'update' },
        { resource: 'user', action: 'delete' },
        { resource: 'chart', action: 'create' },
        { resource: 'chart', action: 'read' },
        { resource: 'chart', action: 'update' },
        { resource: 'chart', action: 'delete' },
        { resource: 'coaching', action: 'access' },
        { resource: 'export', action: 'pdf' },
        { resource: 'export', action: 'png' },
      ],
    },
    {
      name: 'ADMIN',
      description: 'Administrator role',
      permissions: [
        { resource: 'user', action: 'read' },
        { resource: 'user', action: 'update' },
        { resource: 'user', action: 'manage' },
        { resource: 'chart', action: 'read' },
        { resource: 'admin', action: 'access' },
      ],
    },
    {
      name: 'SUPER_ADMIN',
      description: 'Super administrator with full access',
      permissions: [
        { resource: '*', action: '*' },
      ],
    },
  ];

  for (const roleData of roles) {
    // Create or update role
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      update: {
        description: roleData.description,
      },
      create: {
        name: roleData.name,
        description: roleData.description,
      },
    });

    // Assign permissions
    for (const permRef of roleData.permissions) {
      if (permRef.resource === '*' && permRef.action === '*') {
        // Super admin gets all permissions
        const allPerms = await prisma.permission.findMany();
        for (const perm of allPerms) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: perm.id,
              },
            },
            update: {},
            create: {
              roleId: role.id,
              permissionId: perm.id,
            },
          });
        }
      } else {
        const perm = await prisma.permission.findUnique({
          where: {
            resource_action: {
              resource: permRef.resource,
              action: permRef.action,
            },
          },
        });

        if (perm) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: perm.id,
              },
            },
            update: {},
            create: {
              roleId: role.id,
              permissionId: perm.id,
            },
          });
        }
      }
    }

    console.log(`✅ Created role: ${role.name}`);
  }

  console.log('✨ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
