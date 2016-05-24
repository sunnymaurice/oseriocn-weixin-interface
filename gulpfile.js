var gulp = require('gulp'),
    ts = require('gulp-typescript');

gulp.task('copy.json', [], function () {
    return gulp.src(['src/**/*.json'])
        .pipe(gulp.dest('dist'));
});

gulp.task('build', ['copy.json'], function () {
    return gulp.src(['src/**/*.ts'])
        .pipe(ts({ module: 'commonjs' })).js
        .pipe(gulp.dest('dist'));
});