<?php

	echo_html $Options.content;

?>

## Test 1

---

<?php

$test = 1;

if($test){
	echo 'test '.$test;
}else{
	echo 'no test';
}


echo_html '<br><br>';


function test($test){
	if($test & $test != 0){
		echo 'test '.$test;
	}else{
		echo 'no test';
	}
	return $test;
}

test(1);

//echo_html '<br><br>';

//echo $test;
