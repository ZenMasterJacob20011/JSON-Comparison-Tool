/**
 * @typedef  {{paths: {path: String, lineNumber: Number}[], currentPath: String[], indent: Number, out: String, line: Number}} Config
 *
 */

const jdd = {
    LEFT: 'left',
    RIGHT: 'right',

    SEPARATOR: '/',
    TYPE: 'type',
    MISSING: 'missing',
    EQ: 'equal',
    /**
     * @type {{lineNumberLeft: Number,lineNumberRight: Number,message: String,diffType: String}[]}
     */
    diffs: [],
    requestCount: 0,
    diffIndex: 0,
    /**
     * Compares the leftJSON and rightJSON and manipulates document to show differences
     * @param {String} leftJSONString
     * @param {String} rightJSONString
     * @param {String} leftSelector
     * @param {String} rightSelector
     */
    compare: function (leftJSONString, rightJSONString, leftSelector, rightSelector) {
        const leftJSON = jdd.checkValidJSON(leftJSONString)
        const rightJSON = jdd.checkValidJSON(rightJSONString)

        if (typeof leftJSON === 'string' || typeof rightJSON === 'string') {
            if (typeof leftJSON === 'string') {
                jdd.addJSONValidationErrors(leftJSON, jdd.LEFT)
            }
            if (typeof rightJSON === 'string') {
                jdd.addJSONValidationErrors(rightJSON, jdd.RIGHT)
            }
            return
        }

        const config1 = jdd.generateConfig()
        if (Array.isArray(leftJSON)) {
            jdd.decorateConfigArray(config1, leftJSON)
        } else {
            jdd.decorateConfig(config1, leftJSON)
        }
        jdd.removeTrailingComma(config1)
        const config2 = jdd.generateConfig()
        if (Array.isArray(rightJSON)) {
            jdd.decorateConfigArray(config2, rightJSON)
        } else {
            jdd.decorateConfig(config2, rightJSON)
        }
        jdd.removeTrailingComma(config2)
        jdd.hideInitContainer()

        jdd.findDiffs(leftJSON, config1, rightJSON, config2)

        jdd.displayLinedJSON(config1.out, leftSelector)
        jdd.displayLinedJSON(config2.out, rightSelector)

        jdd.displayDiff()
        jdd.displayToolbar()
    },

    /**
     * Checks if the JSON is valid, if true return object, if false return error message
     * @param {String} jsonString
     * @return {String || Object}
     */
    checkValidJSON: function (jsonString) {
        try {
            return JSON.parse(jsonString)
        } catch (/** Error */syntaxError) {
            return `${syntaxError.name}\n${syntaxError.message}`
        }
    },
    /**
     * Adds an error message to document
     * @param {String} message
     * @param {String} side
     */
    addJSONValidationErrors(message, side) {
        if (side === jdd.LEFT) {
            document.getElementById('errorLeft').textContent = message
            document.getElementById('errorLeft').style.display = 'block'
        } else {
            document.getElementById('errorRight').textContent = message
            document.getElementById('errorRight').style.display = 'block'
        }
    },
    /**
     * Generates an object to hold the line number and format of json
     * @return Config
     */
    generateConfig() {
        return {
            paths: [],
            currentPath: [],
            indent: 0,
            out: '',
            line: 1
        }
    },

    /**
     * Takes a json and sorts the current level and puts it into an array
     * @param {Object} json
     * @return {String[]}
     */
    sortJSONKeys(json) {
        const keys = []
        for (let key in json) {
            keys.push(key)
        }
        return keys.sort()
    },
    /**
     * Creates a number of blank spaces
     * @param {Number} numIndents
     * @return {String}
     */
    indentLine(numIndents) {
        let indent = ''
        for (let i = 0; i < numIndents; i++) {
            indent += '    '
        }
        return indent
    },
    /**
     * Decorates configs lines to hold the formatted json
     * @param {Config} config
     * @param {Object} json
     */
    decorateConfig(config, json) {
        const sortedJSON = jdd.sortJSONKeys(json)
        jdd.startObject(config)
        for (let key of sortedJSON) {
            config.currentPath.push(key)
            config.out += `${jdd.newLine(config)}${jdd.indentLine(config.indent)}\"${key}\": `
            config.paths.push({path: jdd.generatePath(config), lineNumber: config.line})
            if (Array.isArray(json[key])) {
                jdd.decorateConfigArray(config, json[key])
            } else if (typeof json[key] === 'object') {
                jdd.decorateConfig(config, json[key])
            } else {
                typeof json[key] === 'number' ? config.out += `${json[key]},` : config.out += `\"${json[key]}\",`
            }
            config.currentPath.pop()
        }
        jdd.removeTrailingComma(config)
        jdd.endObject(config)
    },
    /**
     * Initializes the config object by increasing the indent, adding an open curly brace, and pushing / to the current path
     * @param {Config} config
     */
    startObject(config) {
        config.currentPath.push('/')
        config.indent += 1
        config.out += '{'
    },
    /**
     * Removes trailing comma and adds ending curly bracket
     * @param {Config} config
     */
    endObject(config) {
        config.indent -= 1
        config.out += `${jdd.newLine(config)}${jdd.indentLine(config.indent)}},`
        config.currentPath.pop()
    },
    /**
     * Adds a formatted array to the config object line by line
     * @param {Config} config
     * @param {*[]} array
     */
    decorateConfigArray(config, array) {
        jdd.startConfigArray(config)
        array.forEach(function (arrayVal, index) {
            config.out += `${jdd.newLine(config)}${jdd.indentLine(config.indent)}`
            config.paths.push({path: jdd.generatePath(config, index), lineNumber: config.line})
            config.currentPath.push(`/[${index}]`)
            if (Array.isArray(arrayVal)) {
                jdd.decorateConfigArray(config, arrayVal)
            } else if (typeof arrayVal === 'object') {
                jdd.decorateConfig(config, arrayVal)
            } else if (typeof arrayVal === 'number') {
                config.out += `${arrayVal},`
            } else {
                config.out += `\"${arrayVal}\",`
            }
            config.currentPath.pop()
        })
        jdd.removeTrailingComma(config)
        jdd.endConfigArray(config)
    },
    /**
     * Initializes the start of a line in config with an open bracket and adds 1 to indention
     * @param {Config} config
     */
    startConfigArray(config) {
        config.out += '['
        config.indent += 1
    },
    /**
     * Removes the trailing comma and adds a closing bracket line
     * @param {Config} config
     */
    endConfigArray(config) {
        config.indent -= 1
        config.out += `${jdd.newLine(config)}${jdd.indentLine(config.indent)}],`
    },
    /**
     * Displays each line in the lines array in a box with line numbers
     * @param {String} out
     * @param {String} leftSelector
     */
    displayLinedJSON(out, leftSelector) {
        const container = document.querySelector(leftSelector)
        let lineCnt = 1
        const lines = out.split('\n')
        for (const line of lines) {
            const codeLine = document.createElement("code")
            codeLine.classList.add(`line${lineCnt++}`)
            codeLine.textContent = line + "\n"
            container.append(codeLine)
        }
    },
    /**
     * Hides the initial container
     */
    hideInitContainer() {
        if (document.getElementById('initContainer')) {
            document.getElementById('initContainer').style.display = 'none'
        }
    },
    /**
     * Populates the jdd.diffs array with an objects of schema {lineNumberLeft: Number, lineNumberRight: Number, message: String, diffType: String}
     * @param {Object} leftJSON
     * @param {Object} rightJSON
     * @param {Config} leftConfig
     * @param {Config} rightConfig
     */
    findDiffs(leftJSON, leftConfig, rightJSON, rightConfig) {
        leftConfig.currentPath.push('/')
        rightConfig.currentPath.push('/')
        for (const leftJSONKey in leftJSON) {
            leftConfig.currentPath.push(leftJSONKey)
            if (rightJSON.hasOwnProperty(leftJSONKey)) {
                rightConfig.currentPath.push(leftJSONKey)
                jdd.diffVal(leftJSON[leftJSONKey], leftConfig, rightJSON[leftJSONKey], rightConfig)
                rightConfig.currentPath.pop()
            } else {
                jdd.diffs.push(jdd.generateDiff(leftConfig, jdd.generatePath(leftConfig), rightConfig, jdd.generatePath(rightConfig), `The right side of this object is missing key: ${leftJSONKey}`, jdd.MISSING))
            }
            leftConfig.currentPath.pop()
        }
        for (const rightJSONKey in rightJSON) {
            rightConfig.currentPath.push(rightJSONKey)
            if (!leftJSON.hasOwnProperty(rightJSONKey)) {
                jdd.diffs.push(jdd.generateDiff(leftConfig, jdd.generatePath(leftConfig), rightConfig, jdd.generatePath(rightConfig), `The left side of this object is missing key: ${rightJSONKey}`, jdd.MISSING))
            }
            rightConfig.currentPath.pop()
        }
        leftConfig.currentPath.pop()
        rightConfig.currentPath.pop()
    },
    /**
     * Traverse through array and pushes diffs if found. If both values are arrays or objects recurse down
     * @param {Array} leftArray
     * @param {Config} leftConfig
     * @param {Array} rightArray
     * @param {Config} rightConfig
     */
    findDiffArray(leftArray, leftConfig, rightArray, rightConfig) {
        if (!Array.isArray(rightArray)) {
            jdd.diffs.push(jdd.generateDiff(leftConfig, jdd.generatePath(leftConfig), rightConfig, jdd.generatePath(rightConfig), 'Both types should be Array', jdd.TYPE))
            return
        }
        if (leftArray.length < rightArray.length) {
            for (let i = leftArray.length; i < rightArray.length; i++) {
                jdd.diffs.push(jdd.generateDiff(leftConfig, jdd.generatePath(leftConfig), rightConfig, jdd.generatePath(rightConfig, i), `missing element <code>${i}</code> from the left side`, jdd.MISSING))
            }
        }
        for (let i = 0; i < leftArray.length; i++) {
            leftConfig.currentPath.push(`/[${i}]`)
            rightConfig.currentPath.push(`/[${i}]`)
            if (Array.isArray(leftArray[i]) && Array.isArray(rightArray[i])) {
                jdd.findDiffArray(leftArray[i], leftConfig, rightArray[i], rightConfig)
            } else if (typeof leftArray[i] === 'object' && typeof rightArray[i] === 'object') {
                jdd.findDiffs(leftArray[i], leftConfig, rightArray[i], rightConfig)
            } else {
                jdd.diffVal(leftArray[i], leftConfig, rightArray[i], rightConfig)
            }
            leftConfig.currentPath.pop()
            rightConfig.currentPath.pop()
        }
    },
    /**
     * Checks the differences in values and generates diff if diff found else recurse through objects/array. This compares val1 to val2
     * @param {String || Number || Object || Array || null} val1
     * @param {Config} leftConfig
     * @param {String || Number || Object || Array || null} val2
     * @param {Config} rightConfig
     */
    diffVal(val1, leftConfig, val2, rightConfig) {
        if (Array.isArray(val1)) {
            jdd.findDiffArray(val1, leftConfig, val2, rightConfig)
        } else if (typeof val1 === 'object') {
            if (typeof val2 === 'object') {
                jdd.findDiffs(val1, leftConfig, val2, rightConfig)
            } else {
                jdd.diffs.push(jdd.generateDiff(leftConfig, jdd.generatePath(leftConfig), rightConfig, jdd.generatePath(rightConfig), 'Both types should be Object', jdd.TYPE))
            }
        } else if (typeof val1 === 'number') {
            if (typeof val2 !== 'number') {
                jdd.diffs.push(jdd.generateDiff(leftConfig, jdd.generatePath(leftConfig), rightConfig, jdd.generatePath(rightConfig), 'Both sides should be of type number', jdd.TYPE))
            } else if (val1 !== val2) {
                jdd.diffs.push(jdd.generateDiff(leftConfig, jdd.generatePath(leftConfig), rightConfig, jdd.generatePath(rightConfig), 'Both sides should be equal numbers', jdd.EQ))
            }
        } else if (typeof val1 === 'string') {
            if (typeof val2 !== 'string') {
                jdd.diffs.push(jdd.generateDiff(leftConfig, jdd.generatePath(leftConfig), rightConfig, jdd.generatePath(rightConfig), 'Both sides should be of type string', jdd.TYPE))
            } else if (val1 !== val2) {
                jdd.diffs.push(jdd.generateDiff(leftConfig, jdd.generatePath(leftConfig), rightConfig, jdd.generatePath(rightConfig), 'Both sides should be equal strings', jdd.EQ))
            }
        } else {
            if (val1 == null && val2 != null) {
                jdd.diffs.push(jdd.generateDiff(leftConfig, jdd.generatePath(leftConfig), rightConfig, jdd.generatePath(rightConfig), 'Both sides should be null', jdd.EQ))
            }
        }
    },
    /**
     * Generates a diff object
     * @param {Config} leftConfig
     * @param {String} leftPath
     * @param {Config} rightConfig
     * @param {String} rightPath
     * @param {String} diffMessage
     * @param {jdd.EQ || jdd.TYPE || jdd.MISSING} diffType
     */
    generateDiff(leftConfig, leftPath, rightConfig, rightPath, diffMessage, diffType) {
        return {
            lineNumberLeft: leftConfig.paths.find((obj) => obj.path === leftPath).lineNumber,
            lineNumberRight: rightConfig.paths.find((obj) => obj.path === rightPath).lineNumber,
            message: diffMessage,
            diffType: diffType
        }
    },
    /**
     * Increments configs line number and returns \n
     * @param {Config} config
     * @return {string}
     */
    newLine(config) {
        config.line += 1
        return '\n'
    },
    /**
     * Takes the current path of config and generates it in string form and pushes it to the paths array
     * @param {Config} config
     * @param {Number?} extra
     * @return {String}
     */
    generatePath(config, extra) {
        let s = ''
        config.currentPath.forEach(function (path) {
            s += path
        })

        if (extra !== undefined) {
            s += '/' + `[${extra}]`
        }
        if (s.charAt(s.length - 1) === '/') {
            s = s.substring(0, s.length - 1)
        }
        return s
    },
    /**
     * removes trailing comma from config
     * @param {Config} config
     */
    removeTrailingComma(config) {
        const everythingAfterLastSlashN = config.out.substring(config.out.lastIndexOf('\n'))
        if (everythingAfterLastSlashN.lastIndexOf(',') !== -1) {
            config.out = config.out.substring(0, config.out.length - 1)
        }
    },
    displayDiff() {
        if (jdd.diffs.length === 0) {
            return
        }

        /**
         * Initialize the display to highlight the first diff
         */
        jdd.updateToolbar(jdd.diffs[0].lineNumberLeft, 0)
        jdd.updateToolbar(jdd.diffs[0].lineNumberRight, 0)
        const lineLeftElement = document.querySelector(`#leftDiff > .line${jdd.diffs[0].lineNumberLeft}`)
        const lineRightElement = document.querySelector(`#rightDiff > .line${jdd.diffs[0].lineNumberRight}`)
        if (!lineLeftElement.classList.contains('focusOn')) {
            lineLeftElement.classList.add('focusOn')
        }
        if (!lineRightElement.classList.contains('focusOn')) {
            lineRightElement.classList.add('focusOn')
        }

        jdd.diffs.forEach((diff, index) => {
            jdd.addCSSAndOnClickToLines(diff.lineNumberLeft, diff.lineNumberRight, index, diff.diffType)
        })

        jdd.createReport()

        document.getElementById('diffContainer').style.display = 'block'
    },
    /**
     * Adds event listeners to the diff lines that updates the highlighting of the diffs and toolbar on click
     * @param {Number} lineNumberLeft
     * @param {Number} lineNumberRight
     * @param {Number} diffIndex
     * @param {jdd.EQ || jdd.TYPE || jdd.MISSING} diffType
     */
    addCSSAndOnClickToLines(lineNumberLeft, lineNumberRight, diffIndex, diffType) {
        const lineLeftElement = document.querySelector(`#leftDiff > .line${lineNumberLeft}`)
        const lineRightElement = document.querySelector(`#rightDiff > .line${lineNumberRight}`)

        if (!lineLeftElement.classList.contains(`diffLine${diffType.toUpperCase()}`)) {
            lineLeftElement.classList.add(`diffLine${diffType.toUpperCase()}`)
        }
        if (!lineRightElement.classList.contains(`diffLine${diffType.toUpperCase()}`)) {
            lineRightElement.classList.add(`diffLine${diffType.toUpperCase()}`)
        }
        lineLeftElement.addEventListener('click', () => {
            jdd.focusDiffs(lineNumberLeft, lineNumberRight)
            jdd.updateToolbar(lineNumberLeft, diffIndex)
        })
        lineRightElement.addEventListener('click', () => {
            jdd.focusDiffs(lineNumberLeft, lineNumberRight)
            jdd.updateToolbar(lineNumberRight, diffIndex)

        })
    },
    /**
     * searches the diffs object for lines that match with a diff and appends that diff message to the toolbar
     * @param {Number} lineNumber
     * @param {Number} diffIndex
     */
    updateToolbar(lineNumber, diffIndex) {
        document.getElementById('toolbar').replaceChildren()
        document.getElementById('navIndex').textContent = `${diffIndex + 1} of ${jdd.diffs.length}`
        jdd.diffs.forEach((diff) => {
            if (diff.lineNumberLeft === lineNumber || diff.lineNumberRight === lineNumber) {
                const diffMessage = document.createElement('li')
                diffMessage.classList.add('diffMessage')
                diffMessage.textContent = diff.message
                document.getElementById('toolbar').append(diffMessage)
            }
        })
    },
    /**
     * Displays the toolbar container and adds functionality to forward and backward buttons
     */
    displayToolbar() {
        const navIndex = document.getElementById('navIndex')
        navIndex.textContent = `${jdd.diffIndex + 1} of ${jdd.diffs.length}`

        document.getElementById('backward').addEventListener('click', function () {
            jdd.diffIndex -= 1
            if (jdd.diffIndex < 0) jdd.diffIndex = jdd.diffs.length - 1
            navIndex.textContent = `${jdd.diffIndex + 1} of ${jdd.diffs.length}`
            jdd.updateToolbar(jdd.diffs[jdd.diffIndex].lineNumberLeft, jdd.diffIndex)
            jdd.focusDiffs(jdd.diffs[jdd.diffIndex].lineNumberLeft, jdd.diffs[jdd.diffIndex].lineNumberRight)
        })
        document.getElementById('forward').addEventListener('click', function () {
            jdd.diffIndex += 1
            if (jdd.diffIndex >= jdd.diffs.length) jdd.diffIndex = 0
            navIndex.textContent = `${jdd.diffIndex + 1} of ${jdd.diffs.length}`
            jdd.updateToolbar(jdd.diffs[jdd.diffIndex].lineNumberLeft, jdd.diffIndex)
            jdd.focusDiffs(jdd.diffs[jdd.diffIndex].lineNumberLeft, jdd.diffs[jdd.diffIndex].lineNumberRight)
        })
        document.getElementById('toolbarContainer').style.display = 'inline-block'
    },
    /**
     * Adds focus to the left and right line numbers
     * @param lineNumberLeft
     * @param lineNumberRight
     */
    focusDiffs(lineNumberLeft, lineNumberRight) {
        resetFocusOn()
        const lineLeftElement = document.querySelector(`#leftDiff > .line${lineNumberLeft}`)
        const lineRightElement = document.querySelector(`#rightDiff > .line${lineNumberRight}`)
        if (!lineLeftElement.classList.contains('focusOn')) {
            lineLeftElement.classList.add('focusOn')
        }
        if (!lineRightElement.classList.contains('focusOn')) {
            lineRightElement.classList.add('focusOn')
        }

        function resetFocusOn() {
            for (const child of document.querySelector('#leftDiff').children) {
                child.classList.remove('focusOn')
            }
            for (const child of document.querySelector('#rightDiff').children) {
                child.classList.remove('focusOn')
            }
        }
    },
    createReport() {
        document.getElementById('numDifferences').innerText = `Found ${jdd.diffs.length} differences`
        let type = 0
        let missing = 0
        let eq = 0
        jdd.diffs.forEach((diff) => {
            if (diff.diffType === jdd.TYPE) {
                type++
            } else if (diff.diffType === jdd.EQ) {
                eq++
            } else {
                missing++
            }
        })
        if (missing) {
            const missingCheckboxElement = document.getElementById('missingCheckbox')
            missingCheckboxElement.checked = true
            missingCheckboxElement.insertAdjacentHTML('afterend', `<span>${missing} missing property</span>`)
            document.querySelector('label[for="missingCheckbox"]').style.display = 'inline-block'

            missingCheckboxElement.addEventListener('change', () => {
                if (missingCheckboxElement.checked) {
                    jdd.diffs.forEach((diff) => {
                        if (diff.diffType === 'missing') {
                            addDiffTypeClassToLines(diff.lineNumberLeft, diff.lineNumberRight, diff.diffType)
                        }
                    })
                } else {
                    jdd.diffs.forEach((diff) => {
                        if (diff.diffType === 'missing') {
                            removeDiffTypeClassToLines(diff.lineNumberLeft, diff.lineNumberRight, diff.diffType)
                        }
                    })
                }
            })
        }
        if (type) {
            const typeCheckboxElement = document.getElementById('typeCheckbox')
            typeCheckboxElement.checked = true
            typeCheckboxElement.insertAdjacentHTML('afterend', `<span>${type} incorrect type</span>`)
            document.querySelector('label[for="typeCheckbox"]').style.display = 'inline-block'

            typeCheckboxElement.addEventListener('change', () => {
                if (typeCheckboxElement.checked) {
                    jdd.diffs.forEach((diff) => {
                        if (diff.diffType === 'type') {
                            addDiffTypeClassToLines(diff.lineNumberLeft, diff.lineNumberRight, diff.diffType)
                        }
                    })
                } else {
                    jdd.diffs.forEach((diff) => {
                        if (diff.diffType === 'type') {
                            removeDiffTypeClassToLines(diff.lineNumberLeft, diff.lineNumberRight, diff.diffType)
                        }
                    })
                }
            })
        }
        if (eq) {
            const equalCheckboxElement = document.getElementById('equalCheckbox')
            equalCheckboxElement.checked = true
            equalCheckboxElement.insertAdjacentHTML('afterend', `<span>${eq} unequal value</span>`)
            document.querySelector('label[for="equalCheckbox"]').style.display = 'inline-block'

            equalCheckboxElement.addEventListener('change', () => {
                if (equalCheckboxElement.checked) {
                    jdd.diffs.forEach((diff) => {
                        if (diff.diffType === 'equal') {
                            addDiffTypeClassToLines(diff.lineNumberLeft, diff.lineNumberRight, diff.diffType)
                        }
                    })
                } else {
                    jdd.diffs.forEach((diff) => {
                        if (diff.diffType === 'equal') {
                            removeDiffTypeClassToLines(diff.lineNumberLeft, diff.lineNumberRight, diff.diffType)
                        }
                    })
                }
            })
        }

        /**
         * Adds diff class to diff lines
         * @param {Number} lineNumberLeft
         * @param {Number} lineNumberRight
         * @param {jdd.TYPE || jdd.EQ || jdd.MISSING} diffType
         */
        function addDiffTypeClassToLines(lineNumberLeft, lineNumberRight, diffType) {
            const lineElementLeft = document.querySelector(`#leftDiff > .line${lineNumberLeft}`)
            const lineElementRight = document.querySelector(`#rightDiff > .line${lineNumberRight}`)
            if (!lineElementLeft.classList.contains(`diffLine${diffType.toUpperCase()}`)) {
                lineElementLeft.classList.add(`diffLine${diffType.toUpperCase()}`)
            }
            if (!lineElementRight.classList.contains(`diffLine${diffType.toUpperCase()}`)) {
                lineElementRight.classList.add(`diffLine${diffType.toUpperCase()}`)
            }
        }

        /**
         * Removes diff class from diff lines
         * @param {Number} lineNumberLeft
         * @param {Number} lineNumberRight
         * @param {jdd.TYPE || jdd.EQ || jdd.MISSING} diffType
         */
        function removeDiffTypeClassToLines(lineNumberLeft, lineNumberRight, diffType) {
            const lineElementLeft = document.querySelector(`#leftDiff > .line${lineNumberLeft}`)
            const lineElementRight = document.querySelector(`#rightDiff > .line${lineNumberRight}`)
            if (lineElementLeft.classList.contains(`diffLine${diffType.toUpperCase()}`)) {
                lineElementLeft.classList.remove(`diffLine${diffType.toUpperCase()}`)
            }
            if (lineElementRight.classList.contains(`diffLine${diffType.toUpperCase()}`)) {
                lineElementRight.classList.remove(`diffLine${diffType.toUpperCase()}`)
            }
        }
    }

}


document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('compareJSON').addEventListener('click', function () {
        const leftJSONString = document.getElementById('leftTextArea').value
        const rightJSONString = document.getElementById('rightTextArea').value
        jdd.compare(leftJSONString, rightJSONString, '#leftDiff', '#rightDiff')
    })
    document.getElementById('newDiff').addEventListener('click', () => {
        document.getElementById('diffContainer').style.display = 'none'
        document.getElementById('initContainer').style.display = 'block'
        jdd.diffs = []
        document.getElementById('leftDiff').replaceChildren()
        document.getElementById('rightDiff').replaceChildren()
        document.getElementById('missingCheckbox').replaceWith(document.getElementById('missingCheckbox'))
        document.getElementById('equalCheckbox').replaceWith(document.getElementById('equalCheckbox'))
        document.getElementById('typeCheckbox').replaceWith(document.getElementById('typeCheckbox'))
        if (document.querySelector('label[for="typeCheckbox"] > span')) {
            document.querySelector('label[for="typeCheckbox"] > span').remove()
        }
        if (document.querySelector('label[for="missingCheckbox"] > span')) {
            document.querySelector('label[for="missingCheckbox"] > span').remove()
        }
        if (document.querySelector('label[for="equalCheckbox"] > span')) {
            document.querySelector('label[for="equalCheckbox"] > span').remove()
        }
    })
})
