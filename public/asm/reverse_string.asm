; Reverse String - Reverse a null-terminated string in place
; This program demonstrates string manipulation and byte operations

.DATA
str: .STRING "HELLO"           ; String to reverse

.TEXT
start:
    ; First, find the string length
    MOV R0, str                 ; Start pointer
    MOV R1, #0                  ; Length counter
    
find_length:
    LOADB R2, [R0]              ; Load byte at current position
    CMP R2, #0                  ; Check for null terminator
    JZ length_found             ; Jump if end of string
    INC R1                      ; Increment length
    INC R0                      ; Move to next character
    JMP find_length             ; Continue
    
length_found:
    ; Now reverse the string
    MOV R0, str                 ; Left pointer (start)
    MOV R2, str                 ; Right pointer (will be set to end)
    ADD R2, R1                  ; Move right pointer to end
    DEC R2                      ; Adjust to last character
    
reverse_loop:
    CMP R0, R2                  ; Check if pointers meet or cross
    JGE done                    ; Done if left >= right
    
    ; Swap characters at R0 and R2
    LOADB R3, [R0]              ; Load left character
    LOADB R4, [R2]              ; Load right character
    STOREB [R0], R4             ; Store right char at left position
    STOREB [R2], R3             ; Store left char at right position
    
    INC R0                      ; Move left pointer right
    DEC R2                      ; Move right pointer left
    JMP reverse_loop            ; Continue
    
done:
    ; String is now reversed: "OLLEH"
    MOV R1, str                 ; Load string address for printing
    SYS #2                      ; Print the reversed string
    MOV R0, #0                  ; Exit code 0
    SYS #3                      ; Exit program
    HALT