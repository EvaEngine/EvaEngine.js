const gulp = require('gulp');
const path = require('path');
const babel = require('gulp-babel');
const sourceMaps = require('gulp-sourcemaps');

const paths = {
  es6: ['./src/**/*.js'],
  es5: './lib',
  sourceRoot: path.join(__dirname, 'src')
};

gulp.task('babel', () => {
  return gulp.src(paths.es6).pipe(sourceMaps.init()).pipe(babel({
    presets: ['stage-3', 'es2015-node4'],
    plugins: [
      "transform-decorators-legacy",
      [
        'babel-plugin-transform-builtin-extend',
        {
          globals: ['Error']
        }
      ]
    ]
  })).pipe(sourceMaps.write('.', {
    includeContent: false,
    sourceRoot: paths.sourceRoot
  })).pipe(gulp.dest(paths.es5));
});
