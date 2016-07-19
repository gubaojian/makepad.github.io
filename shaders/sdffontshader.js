module.exports = require('./tweenshader').extend(function SdfFontShader(proto, base){

	var types = require('types')
	var painter = require('painter')
	var fontloader = require('loaders/fontloader')

	// special
	proto.props = {
		visible:{noTween:1, value:1.},
		x:0,
		y:0,

		lineSpacing:1.3,

		color:{pack:'float12', value:'black'},
		outlineColor:{pack:'float12', value:'white'},
		shadowColor: {pack:'float12', value:[0,0,0,0.5]},

		fontSize:14,

		italic:0,
		baseLine:1,

		shadowBlur: 5.0,
		shadowSpread: -2.,

		outlineWidth:0.,
		boldness:1., 
		shadowOffset: {pack:'int12', value:[2.0,2.0]},

		unicode:{noStyle:1,noTween:1,value:0},

		fontSampler:{kind:'sampler', sampler:painter.SAMPLER2DLINEAR},

		lineBreak:{doStyle:1, value:'word'},
		text:{doStyle:1, value:''},

		x1:{noStyle:1,noTween:1,value:0},
		y1:{noStyle:1,noTween:1,value:0},
		x2:{noStyle:1,noTween:1,value:0},
		y2:{noStyle:1,noTween:1,value:0},
		tx1:{noStyle:1,noTween:1,value:0},
		ty1:{noStyle:1,noTween:1,value:0},
		tx2:{noStyle:1,noTween:1,value:0},
		ty2:{noStyle:1,noTween:1,value:0},
	}

	proto.mesh = painter.Mesh(types.vec3).pushQuad(
		0, 0, 0,
		0, 1, 0,
		1, 0, 0,
		1, 1, 0
	).pushQuad(
		0,0, 1,
		1,0, 1,
		0, 1, 1,
		1, 1, 1
	)

	proto.vertexStyle = function(){
	}

	proto.pixelStyle = function(){
		//this.outlineWidth = abs(sin(this.mesh.y*10.))*3.+1.
		//this.field += sin(this.mesh.y*10.)*3.*cos(this.mesh.x*10.)*3.
	}

	proto.vertex = function(){$
		this.vertexStyle()

		if(this.visible < 0.5){
			return vec4(0.)
		}

		var pos = mix(
			vec2(
				this.x + this.fontSize * this.x1,
				this.y - this.fontSize * this.y1 + this.fontSize * this.baseLine
			),
			vec2(
				this.x + this.fontSize * this.x2,// * this.italic,
				this.y - this.fontSize * this.y2 + this.fontSize * this.baseLine
			),
			this.mesh.xy
		)

		// shadow
		if(this.mesh.z < 0.5){
			if(abs(this.shadowOffset.x)<0.001 && abs(this.shadowOffset.y)<0.001 && this.shadowBlur<2.0){
				return vec4(0)
			}
			var meshmz = this.mesh.xy *2. - 1.
			pos.xy += this.shadowOffset.xy// + vec2(this.shadowSpread , -this.shadowSpread) * meshmz
		}

		this.textureCoords = mix(
			vec2(this.tx1, this.ty1), 
			vec2(this.tx2, this.ty2), 
			this.mesh.xy
		)

		return vec4(pos,0.,1.) * this.viewPosition * this.camPosition * this.camProjection
	}

	proto.drawField = function(field){$
		if(field > 1. + this.outlineWidth){
			discard
		}

		if(this.outlineWidth>0.){
			var outline = abs(field) - (this.outlineWidth)
			var inner = field + this.outlineWidth
			var borderfinal = mix(this.outlineColor, vec4(this.outlineColor.rgb, 0.), clamp(outline,0.,1.))
			return mix(this.color, borderfinal, clamp(inner, 0., 1.))
		}

		return vec4(this.color.rgb, smoothstep(.75,-.75, field))
	}

	proto.drawShadow = function(field){
		var shadowfield = (field-clamp(this.shadowBlur,1.,26.))/this.shadowBlur-this.shadowSpread
		return mix(this.shadowColor, vec4(this.shadowColor.rgb,0.), clamp(shadowfield,0.,1.))
	}

	proto.pixel = function(){$
		var adjust = length(vec2(length(dFdx(this.textureCoords.x)), length(dFdy(this.textureCoords.y))))
		var field = (((.75-texture2D(this.fontSampler, this.textureCoords.xy).r)*4.) * 0.005) / adjust * 1.4 + 1.
		this.field = field

		this.pixelStyle()

		field = this.field - this.boldness

		if(this.mesh.z < 0.5){
			return this.drawShadow(field)
		}
		return this.drawField(field)
	}

	proto.canvasMacros = {
		draw:function(overload){
			var turtle = this.turtle
			this.$STYLEPROPS(len)

			var txt = turtle._text
			var len = txt.length

			this.$ALLOCDRAW(len)

			// lets fetch the font
			var glyphs = this._NAME.prototype.font.fontmap.glyphs
			var lineBreak = turtle._lineBreak
			var fontSize = turtle._fontSize
			var lineSpacing = turtle._lineSpacing
			var baseLine = turtle._baseLine
			var off = 0

			turtle._h = fontSize * lineSpacing
			//turtle._x = 10
			//turtle._y = 0

			while(off < len){
				var width = 0
				var start = off
				if(!lineBreak){
					for(var b = off; b < len; b++){
						var unicode = txt.charCodeAt(b)
						width += glyphs[unicode].advance * fontSize
					}
					off = len
				}
				else if(lineBreak === 'char'){
					width += glyphs[txt.charCodeAt(off)].advance * fontSize
					off++
				}
				else{
					for(var b = off; b < len; b++){
						var unicode = txt.charCodeAt(b)
						width += glyphs[unicode].advance * fontSize
						if(b > off && (unicode === 32||unicode===9)){
							break
						}
					}
					off = b
				}
				if(width){
					turtle._w = width
					this.walkTurtle()
					for(var i = start; i < off; i++){
						var unicode = txt.charCodeAt(i)
						//if(unicode !== 32 && unicode !== 9 && unicode !== 10){
						var g = glyphs[unicode]
						this.$WRITEPROPS({
							tx1: g.tx1,
							ty1: g.ty1,
							tx2: g.tx2,
							ty2: g.ty2,
							x1: g.x1,
							y1: g.y1,
							x2: g.x2,
							y2: g.y2,
							unicode: unicode
						})
						turtle._x += g.advance * fontSize
					}
				}
			}
		},
		begin:function(){
		},
		end:function(){
		}
	}

	proto.onextendclass = function(){
		if(this.font && !this.font.fontmap){
			var map = this.font.fontmap = fontloader(this.font)
			// make the texture.
			this.fontSampler = painter.Texture.fromArray2D(painter.LUMINANCE, map.texw, map.texh, map.textureArray)
		}
		base.onextendclass.apply(this, arguments)
	}
})