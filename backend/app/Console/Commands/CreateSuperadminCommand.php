<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class CreateSuperadminCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'user:create-superadmin
        {email : Email akun superadmin}
        {name : Nama superadmin}
        {password : Password awal superadmin}
        {--phone= : Nomor telepon superadmin}';

    /**
     * @var string
     */
    protected $description = 'Create a new superadmin account or promote an existing user into superadmin.';

    /**
     * Membuat akun superadmin baru atau mempromosikan user lama dengan kredensial terbaru.
     */
    public function handle(): int
    {
        $email = User::normalizeEmail((string) $this->argument('email'));
        $name = trim((string) $this->argument('name'));
        $password = (string) $this->argument('password');
        $phone = User::normalizePhone((string) ($this->option('phone') ?? ''));

        if (!$email || !$name || trim($password) === '') {
            $this->error('Email, nama, dan password wajib diisi.');
            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();

        if ($user) {
            $user->forceFill([
                'name' => $name,
                'phone' => $phone ?: $user->phone,
                'password' => Hash::make($password),
                'role' => User::ROLE_SUPERADMIN,
                'account_status' => User::STATUS_ACTIVE,
                'account_status_reason' => null,
            ])->save();

            $this->info("User {$email} berhasil dipromosikan menjadi superadmin.");
            return self::SUCCESS;
        }

        User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'role' => User::ROLE_SUPERADMIN,
            'phone' => $phone,
            'company_name' => 'KerjaNusa Superadmin',
            'account_status' => User::STATUS_ACTIVE,
        ]);

        $this->info("Superadmin {$email} berhasil dibuat.");
        return self::SUCCESS;
    }
}
