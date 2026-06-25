<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('users') || !Schema::hasColumn('users', 'phone')) {
            return;
        }

        DB::table('users')
            ->where('phone', '')
            ->update(['phone' => null]);

        $duplicatePhones = DB::table('users')
            ->select('phone')
            ->whereNotNull('phone')
            ->where('phone', '!=', '')
            ->groupBy('phone')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('phone');

        foreach ($duplicatePhones as $phone) {
            $duplicateUserIds = DB::table('users')
                ->where('phone', $phone)
                ->orderBy('id')
                ->pluck('id');

            if ($duplicateUserIds->count() < 2) {
                continue;
            }

            DB::table('users')
                ->whereIn('id', $duplicateUserIds->slice(1)->all())
                ->update(['phone' => null]);
        }

        Schema::table('users', function (Blueprint $table) {
            $table->unique('phone');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_phone_unique');
        });
    }
};
