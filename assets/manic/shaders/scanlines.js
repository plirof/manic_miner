  //Caligari's scanlines shader by Caligari
  class Scanlines extends WebGLExt {
    constructor() {
      super();
    };

    setExt() {
      super.setExt();

      this.gl.uniform2fv(this.ext.inputSize, [fullWidth, fullHeight]);
      this.gl.uniform2fv(this.ext.outputSize, [this.buffer.width, this.buffer.height]);
      this.gl.uniform2fv(this.ext.textureSize, [fullWidth, fullHeight]);
    };

    createExt() {
      const vertexSource = `
        precision mediump float;

        attribute vec4 a_position;

        uniform mat4 u_vmatrix;
        uniform mat4 u_tmatrix;
        uniform vec2 u_input_size;
        uniform vec2 u_output_size;
        uniform vec2 u_texture_size;

        varying vec2 v_texcoord;

        void main() {
          gl_Position = u_vmatrix * a_position;
          v_texcoord = (u_tmatrix * a_position).xy;
        }
      `;

      const fragmentSource = `
        precision mediump float;

        uniform sampler2D u_texture;
        uniform vec2 u_input_size;
        uniform vec2 u_output_size;
        uniform vec2 u_texture_size;

        varying vec2 v_texcoord;

        // 0.5 = the spot stays inside the original pixel
        // 1.0 = the spot bleeds up to the center of next pixel
        #define SPOT_WIDTH  0.9
        #define SPOT_HEIGHT 0.65

        // Used to counteract the desaturation effect of weighting.
        #define COLOR_BOOST 2.45

        // Different way to handle RGB phosphors.
        //#define RGB_BAR
        //#define RGB_TRIAD
        #define MG_BAR

        // Constants used for gamma correction.
        #define inputGamma 2.4
        #define outputGamma 3.2

        // Uncomment one of these to choose a gamma correction method.
        // If none are uncommented, no gamma correction is done.
        #define REAL_GAMMA
        //#define FAKE_GAMMA
        //#define FAKER_GAMMA

        #ifdef REAL_GAMMA
          #define GAMMA_IN(color)  pow(color, vec4(inputGamma))
          #define GAMMA_OUT(color) pow(color, vec4(1.0 / outputGamma))

        #elif defined FAKE_GAMMA
          vec4 A_IN  = vec4(12.0 / (inputGamma + 1.0) - 3.0);
          vec4 B_IN  = vec4(1.0) - A_IN;
          vec4 A_OUT = vec4(6.0 - 15.0 * outputGamma / 2.0 / (outputGamma + 1.0));
          vec4 B_OUT = vec4(1.0) - A_OUT;

          #define GAMMA_IN(color)  ((A_IN + B_IN * color) * color * color)
          #define GAMMA_OUT(color) (A_OUT * sqrt(color) + B_OUT * sqrt(sqrt(color)))

        #elif defined FAKER_GAMMA
          vec4 A_IN = vec4(6.0 / (inputGamma / outputGamma + 1.0) - 2.0);
          vec4 B_IN = vec4(1.0) - A_IN;

          #define GAMMA_IN(color)  ((A_IN + B_IN * color) * color)
          #define GAMMA_OUT(color) color

        #else
          #define GAMMA_IN(color)  color
          #define GAMMA_OUT(color) color
        #endif

        #define TEX2D(coords) GAMMA_IN(texture2D(u_texture, coords))

        #define WEIGHT(w) \
          if (w > 1.0) w = 1.0; \
          w = 1.0 - w * w; \
          w = w * w;

        vec2 onex = vec2( 1.0/u_texture_size.x, 0.0 );
        vec2 oney = vec2( 0.0, 1.0/u_texture_size.y );

        void main(void) {
          vec2 coords = (v_texcoord * u_texture_size);
          vec2 pixel_center = floor(coords) + vec2(0.5);
          vec2 texture_coords = pixel_center / u_texture_size;

          vec4 color = TEX2D(texture_coords);

          float dx = coords.x - pixel_center.x;
          float h_weight_00 = dx / SPOT_WIDTH;

          WEIGHT(h_weight_00);
          color *= vec4(h_weight_00);

          vec2 coords01;

          if (dx > 0.0) {
            coords01 = onex;
            dx = 1.0 - dx;
          } else {
            coords01 = -onex;
            dx = 1.0 + dx;
          }

          vec4 colorNB = TEX2D(texture_coords + coords01);

          float h_weight_01 = dx / SPOT_WIDTH;

          WEIGHT(h_weight_01);
          color = color + colorNB * vec4(h_weight_01);

          float dy = coords.y - pixel_center.y;
          float v_weight_00 = dy / SPOT_HEIGHT;

          WEIGHT(v_weight_00);
          color *= vec4(v_weight_00);

          vec2 coords10;

          if (dy > 0.0) {
            coords10 = oney;
            dy = 1.0 - dy;
          } else {
            coords10 = -oney;
            dy = 1.0 + dy;
          }

          colorNB = TEX2D( texture_coords + coords10 );

          float v_weight_10 = dy / SPOT_HEIGHT;
          WEIGHT(v_weight_10);

          color = color + colorNB * vec4(v_weight_10 * h_weight_00);
          colorNB = TEX2D(texture_coords + coords01 + coords10);
          color = color + colorNB * vec4(v_weight_10 * h_weight_01);
          color *= vec4(COLOR_BOOST);

          #ifdef RGB_BAR
            vec2 output_coords = floor( v_texcoord * u_output_size);
            float modulo = mod(output_coords.x, 3.0);

            if (modulo == 0.0) {
              color = color * vec4(1.4, 0.5, 0.5, 0.0);
            } else if (modulo == 1.0) {
              color = color * vec4(0.5, 1.4, 0.5, 0.0);
            } else {
              color = color * vec4(0.5, 0.5, 1.4, 0.0);
            }
          #endif

          #ifdef RGB_TRIAD
            vec2 output_coords = floor(v_texcoord * u_output_size / u_input_size * u_texture_size);
            float modulo = mod(output_coords.x, 2.0);

            if (modulo < 1.0) {
              modulo = mod(output_coords.y, 6.0);
            } else {
              modulo = mod(output_coords.y + 3.0, 6.0);

              if (modulo < 2.0) {
                color = color * vec4(1.0, 0.0, 0.0, 0.0);
              } else if (modulo < 4.0) {
                color = color * vec4(0.0, 1.0, 0.0, 0.0);
              } else {
                color = color * vec4(0.0, 0.0, 1.0, 0.0);
              }
          #endif

          #ifdef MG_BAR
            vec2 output_coords = floor(v_texcoord * u_output_size);
            float modulo = mod(output_coords.x, 2.0);

            if (modulo == 0.0) {
              color = color * vec4(1.0, 0.1, 1.0, 0.0);
            } else {
              color = color * vec4(0.1, 1.0, 0.1, 0.0);
            }
          #endif

          gl_FragColor = clamp(GAMMA_OUT(color), 0.0, 1.0);
        }
      `;

      const program = this.compileProgram(vertexSource, fragmentSource);

      this.ext = {
        program:     program,
        buffer:      this.createVertexBuffer(new Float32Array([0,0,0,1,1,0,1,0,0,1,1,1])),
        position:    this.gl.getAttribLocation(program, "a_position"),
        vmatrix:     this.gl.getUniformLocation(program, "u_vmatrix"),
        tmatrix:     this.gl.getUniformLocation(program, "u_tmatrix"),
        texture:     this.gl.getUniformLocation(program, "u_texture"),
        inputSize:   this.gl.getUniformLocation(program, "u_input_size"),
        outputSize:  this.gl.getUniformLocation(program, "u_output_size"),
        textureSize: this.gl.getUniformLocation(program, "u_texture_size")
      };
    };
  }