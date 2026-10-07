<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json(['servicio' => 'restaurarte-laravel', 'ok' => true]);
});
